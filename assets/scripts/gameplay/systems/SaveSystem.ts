/**
 * 存档系统
 * 
 * 处理 ECS 数据序列化和存档/读档操作
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 被动系统，只处理外部调用
 * - 存档只包含可推导的纯数据，不包含任何运行时状态
 * - 读档通过重建 World 实现，而非修补现有状态
 * - EntityId 不作为稳定标识（读档时重新生成）
 * - 存档版本严格校验，不做隐式兼容
 * - 当前阶段仅支持玩家实体存档
 * 
 * 设计决策：混合方案（白名单 + 自定义序列化器，按需使用）
 * 参考文档：memory-bank/creative/creative-save-system.md
 */

import { System, system, Entity, World, Component } from '@bl-framework/ecs';
import { TransformComponent } from '../components/Transform';
import { HPComponent } from '../components/HP';
import { StatsComponent } from '../components/Stats';
import { LevelExperienceComponent } from '../components/LevelExperience';
import { InventoryComponent, InventoryItem } from '../components/Inventory';
import { EquipmentComponent, EquipmentData } from '../components/Equipment';
import { BuffListComponent, BuffData } from '../components/BuffList';
import { SkillSlotsComponent, SkillSlotData } from '../components/SkillSlots';
import { FactionComponent } from '../components/Faction';
import { ColliderComponent } from '../components/Collider';
import { ViewLinkComponent } from '../components/ViewLink';
import { AnimStateComponent } from '../components/AnimState';
import { ConfigLoader } from '../../ConfigLoader';

// 声明 Cocos Creator 的全局 sys 对象类型
declare const sys: any;

// ==================== 存档数据格式 ====================

/**
 * 存档数据
 */
export interface SaveData {
    version: string;                    // 存档版本（如 "1.0.0"），严格校验
    timestamp: number;                  // 存档时间戳
    gameTime?: number;                  // 游戏时间（可选）
    entities: EntitySaveData[];        // 实体数据（当前阶段只包含玩家实体）
}

/**
 * 实体存档数据
 * ❌ 不包含 EntityId（EntityId 不作为稳定标识，读档时重新生成）
 */
export interface EntitySaveData {
    name: string;                       // 实体名称（用于识别玩家实体，如 "Player"）
    components: ComponentSaveData[];    // 组件数据（只包含纯数据，不包含运行时状态）
}

/**
 * 组件存档数据
 */
export interface ComponentSaveData {
    type: string;                       // 组件类型名称（如 "Transform"）
    data: any;                          // 组件数据（已过滤配置引用和运行时状态，只包含纯数据）
}

/**
 * 存档信息（用于显示存档列表）
 */
export interface SaveInfo {
    slotIndex: number;
    timestamp: number;
    version: string;
    gameTime?: number;
    entityName?: string;                // 玩家实体名称
}

// ==================== 组件序列化器接口 ====================

/**
 * 组件序列化器接口
 */
interface ComponentSerializer {
    /**
     * 序列化组件（只保存纯数据，过滤配置引用和运行时状态）
     */
    serialize(component: Component): any;
    
    /**
     * 反序列化组件（重建组件，从 ConfigLoader 加载配置引用）
     * @param entity 目标实体
     * @param data 序列化数据
     * @param configLoader 配置加载器（用于加载配置引用）
     */
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void;
}

// ==================== 组件序列化器实现 ====================

/**
 * Transform 组件序列化器（基础序列化）
 */
class TransformComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const transform = component as TransformComponent;
        return {
            x: transform.x,
            y: transform.y,
            rot: transform.rot,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const transform = entity.addComponent(TransformComponent);
        transform.x = data.x || 0;
        transform.y = data.y || 0;
        transform.rot = data.rot || 0;
    }
}

/**
 * HP 组件序列化器（基础序列化）
 */
class HPComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const hp = component as HPComponent;
        return {
            cur: hp.cur,
            max: hp.max,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const hp = entity.addComponent(HPComponent);
        hp.cur = data.cur || 100;
        hp.max = data.max || 100;
    }
}

/**
 * Stats 组件序列化器（基础序列化，所有属性都是纯数据）
 */
class StatsComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const stats = component as StatsComponent;
        return {
            base: { ...stats.base },
            equipment: { ...stats.equipment },
            buffFixed: { ...stats.buffFixed },
            buffPercent: { ...stats.buffPercent },
            levelup: { ...stats.levelup },
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const stats = entity.addComponent(StatsComponent);
        if (data.base) Object.assign(stats.base, data.base);
        if (data.equipment) Object.assign(stats.equipment, data.equipment);
        if (data.buffFixed) Object.assign(stats.buffFixed, data.buffFixed);
        if (data.buffPercent) Object.assign(stats.buffPercent, data.buffPercent);
        if (data.levelup) Object.assign(stats.levelup, data.levelup);
    }
}

/**
 * LevelExperience 组件序列化器（基础序列化）
 */
class LevelExperienceComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const levelExp = component as LevelExperienceComponent;
        return {
            level: levelExp.level,
            maxLevel: levelExp.maxLevel,
            exp: levelExp.exp,
            expRequired: levelExp.expRequired,
            totalExp: levelExp.totalExp,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const levelExp = entity.addComponent(LevelExperienceComponent);
        levelExp.level = data.level || 1;
        levelExp.maxLevel = data.maxLevel || 100;
        levelExp.exp = data.exp || 0;
        levelExp.totalExp = data.totalExp || 0;
        // expRequired 直接设置（如果提供了）
        if (data.expRequired !== undefined) {
            levelExp.expRequired = data.expRequired;
        } else {
            // 如果没有提供，使用默认计算方式（简单二次曲线）
            const base = 100;
            levelExp.expRequired = base * levelExp.level * levelExp.level;
        }
    }
}

/**
 * Inventory 组件序列化器（自定义序列化器，过滤配置引用）
 */
class InventoryComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const inventory = component as InventoryComponent;
        return {
            slots: inventory.slots.map(slot => {
                if (!slot) return null;
                // ✅ 只保存纯数据：itemId、count、slotIndex
                // ❌ 不保存 config（配置引用）
                return {
                    itemId: slot.itemId,
                    count: slot.count,
                    slotIndex: slot.slotIndex,
                };
            }),
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const inventory = entity.addComponent(InventoryComponent);
        
        inventory.slots = data.slots.map((slotData: any, index: number) => {
            if (!slotData) return null;
            
            // 从 ConfigLoader 重新加载配置（配置引用重建）
            const config = configLoader.getItemConfig(slotData.itemId);
            if (!config) {
                console.warn(`[SaveSystem] Item config not found: ${slotData.itemId}`);
                return null;
            }
            
            // 重建 InventoryItem（包含配置引用）
            return {
                itemId: slotData.itemId,
                config: config,              // 从 ConfigLoader 重新加载
                count: slotData.count,
                slotIndex: index,
            };
        });
    }
}

/**
 * Equipment 组件序列化器（自定义序列化器，过滤配置引用）
 */
class EquipmentComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const equipment = component as EquipmentComponent;
        const slots: Record<string, any> = {};
        
        for (const slotType of Object.keys(equipment.slots)) {
            const equipmentData = equipment.slots[slotType as any];
            if (!equipmentData) {
                slots[slotType] = null;
            } else {
                // ✅ 只保存纯数据：equipmentId、level、durability
                // ❌ 不保存 config（配置引用）
                slots[slotType] = {
                    equipmentId: equipmentData.equipmentId,
                    level: equipmentData.level,
                    durability: equipmentData.durability,
                };
            }
        }
        
        return { slots };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const equipment = entity.addComponent(EquipmentComponent);
        
        for (const slotType of Object.keys(data.slots)) {
            const equipmentData = data.slots[slotType];
            if (!equipmentData) {
                equipment.slots[slotType as any] = null;
            } else {
                // 从 ConfigLoader 重新加载配置
                const config = configLoader.getEquipmentConfig(equipmentData.equipmentId);
                if (!config) {
                    console.warn(`[SaveSystem] Equipment config not found: ${equipmentData.equipmentId}`);
                    equipment.slots[slotType as any] = null;
                } else {
                    // 重建 EquipmentData（包含配置引用）
                    equipment.slots[slotType as any] = {
                        equipmentId: equipmentData.equipmentId,
                        config: config,              // 从 ConfigLoader 重新加载
                        level: equipmentData.level || 1,
                        durability: equipmentData.durability,
                    };
                }
            }
        }
    }
}

/**
 * BuffList 组件序列化器（自定义序列化器，BuffData 不包含配置引用，都是纯数据）
 */
class BuffListComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const buffList = component as BuffListComponent;
        const buffs: Record<string, any> = {};
        
        for (const type of Object.keys(buffList.buffs)) {
            const buffData = buffList.buffs[type];
            // ✅ BuffData 中不包含配置引用，都是纯数据
            buffs[type] = {
                id: buffData.id,
                type: buffData.type,
                duration: buffData.duration,
                stacks: buffData.stacks,
                params: { ...buffData.params },
                source: buffData.source,
            };
        }
        
        return { buffs };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const buffList = entity.addComponent(BuffListComponent);
        
        for (const type of Object.keys(data.buffs)) {
            const buffData = data.buffs[type];
            buffList.buffs[type] = {
                id: buffData.id,
                type: buffData.type,
                duration: buffData.duration,
                stacks: buffData.stacks,
                params: { ...buffData.params },
                source: buffData.source,
            };
        }
    }
}

/**
 * SkillSlots 组件序列化器（自定义序列化器，过滤配置引用）
 */
class SkillSlotsComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const skillSlots = component as SkillSlotsComponent;
        return {
            slots: skillSlots.slots.map(slot => {
                if (!slot) return null;
                // ✅ 只保存纯数据：skillId、cooldown、uses、maxUses、level
                // ❌ 不保存 config（配置引用）
                // 注意：cooldown 是运行时状态，但可能需要保存（如果读档时恢复冷却状态）
                // 根据需求决定：这里先保存，后续可以改为不保存
                return {
                    skillId: slot.skillId,
                    cooldown: slot.cooldown,        // 运行时状态，可以考虑不保存
                    maxCooldown: slot.maxCooldown,
                    uses: slot.uses,
                    maxUses: slot.maxUses,
                    level: slot.level,
                };
            }),
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const skillSlots = entity.addComponent(SkillSlotsComponent);
        
        skillSlots.slots = data.slots.map((slotData: any, index: number) => {
            if (!slotData) return null;
            
            // 从 ConfigLoader 重新加载配置
            const config = configLoader.getSkillConfig(slotData.skillId);
            if (!config) {
                console.warn(`[SaveSystem] Skill config not found: ${slotData.skillId}`);
                return null;
            }
            
            // 重建 SkillSlotData（包含配置引用）
            return {
                skillId: slotData.skillId,
                config: config,              // 从 ConfigLoader 重新加载
                cooldown: slotData.cooldown || 0,
                maxCooldown: slotData.maxCooldown || config.cooldown || 0,
                uses: slotData.uses || 0,
                maxUses: slotData.maxUses !== undefined ? slotData.maxUses : -1,
                level: slotData.level || 1,
            };
        });
    }
}

/**
 * Faction 组件序列化器（基础序列化）
 */
class FactionComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const faction = component as FactionComponent;
        return {
            faction: faction.faction,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const faction = entity.addComponent(FactionComponent);
        faction.faction = data.faction;
    }
}

/**
 * Collider 组件序列化器（基础序列化）
 */
class ColliderComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const collider = component as ColliderComponent;
        return {
            type: collider.type,
            radius: collider.radius,
            height: collider.height,
            isTrigger: collider.isTrigger,
            layer: collider.layer,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const collider = entity.addComponent(ColliderComponent);
        collider.type = data.type || 'circle';
        collider.radius = data.radius || 50;
        collider.height = data.height || 50;
        collider.isTrigger = data.isTrigger || false;
        collider.layer = data.layer || 0;
    }
}

/**
 * ViewLink 组件序列化器（部分序列化，只保存 prefabKey，不保存 viewId）
 */
class ViewLinkComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const viewLink = component as ViewLinkComponent;
        // ✅ 只保存 prefabKey（用于重建 View）
        // ❌ 不保存 viewId（运行时状态，读档时重新生成）
        return {
            prefabKey: viewLink.prefabKey,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const viewLink = entity.addComponent(ViewLinkComponent);
        viewLink.prefabKey = data.prefabKey || '';
        // viewId 不设置，由 ViewManager 在重建 View 时生成
    }
}

/**
 * AnimState 组件序列化器（部分序列化，不保存 lastSentAnim）
 */
class AnimStateComponentSerializer implements ComponentSerializer {
    serialize(component: Component): any {
        const animState = component as AnimStateComponent;
        // ✅ 只保存纯数据状态：current、locked、speed
        // ❌ 不保存 lastSentAnim（运行时优化数据，读档时重置）
        return {
            current: animState.current,
            locked: animState.locked,
            speed: animState.speed,
        };
    }
    
    deserialize(entity: Entity, data: any, configLoader: ConfigLoader): void {
        const animState = entity.addComponent(AnimStateComponent);
        animState.current = data.current || 'idle';
        animState.locked = data.locked || false;
        animState.speed = data.speed || 1.0;
        // lastSentAnim 不设置，使用 reset() 的默认值 ''
    }
}

// ==================== 组件白名单配置 ====================

/**
 * 需要序列化的组件白名单
 */
const SAVABLE_COMPONENTS = new Set([
    'Transform',
    'HP',
    'Stats',
    'LevelExperience',
    'Inventory',
    'Equipment',
    'BuffList',
    'SkillSlots',
    'Faction',
    'Collider',
    'ViewLink',        // 部分序列化
    'AnimState',       // 部分序列化
]);

/**
 * 不序列化的组件（运行时状态）
 */
const TEMPORARY_COMPONENTS = new Set([
    'DeadTag',
    'NeedViewTag',
    'DestroyTimer',
    'AnimationIntent',
    'FxIntent',
    'AudioIntent',
    'Velocity',        // 速度是运行时计算的
    'AI',              // AI 状态是运行时状态
]);

/**
 * 需要自定义序列化器的组件
 */
const CUSTOM_SERIALIZER_COMPONENTS = new Set([
    'Inventory',
    'Equipment',
    'BuffList',
    'SkillSlots',
]);

// ==================== SaveSystem 主类 ====================

@system({ priority: 99 })  // 最后执行
export class SaveSystem extends System {
    private configLoader?: ConfigLoader;
    private readonly currentVersion: string = '1.0.0';  // 当前存档版本
    
    /** 组件序列化器映射 */
    private serializers: Map<string, ComponentSerializer> = new Map();
    
    constructor() {
        super();
        this.registerSerializers();
    }
    
    /**
     * 注册所有组件序列化器
     */
    private registerSerializers(): void {
        this.serializers.set('Transform', new TransformComponentSerializer());
        this.serializers.set('HP', new HPComponentSerializer());
        this.serializers.set('Stats', new StatsComponentSerializer());
        this.serializers.set('LevelExperience', new LevelExperienceComponentSerializer());
        this.serializers.set('Inventory', new InventoryComponentSerializer());
        this.serializers.set('Equipment', new EquipmentComponentSerializer());
        this.serializers.set('BuffList', new BuffListComponentSerializer());
        this.serializers.set('SkillSlots', new SkillSlotsComponentSerializer());
        this.serializers.set('Faction', new FactionComponentSerializer());
        this.serializers.set('Collider', new ColliderComponentSerializer());
        this.serializers.set('ViewLink', new ViewLinkComponentSerializer());
        this.serializers.set('AnimState', new AnimStateComponentSerializer());
    }
    
    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }
    
    /**
     * 保存游戏状态（只保存玩家实体）
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否成功保存
     */
    saveGame(slotIndex: number): boolean {
        if (slotIndex < 0 || slotIndex > 9) {
            console.error(`[SaveSystem] Invalid slot index: ${slotIndex}. Must be between 0 and 9.`);
            return false;
        }
        
        try {
            // 查找玩家实体
            const playerEntity = this.findPlayerEntity();
            if (!playerEntity) {
                console.error('[SaveSystem] Player entity not found');
                return false;
            }
            
            // 序列化玩家实体
            const entityData = this.serializeEntity(playerEntity);
            if (!entityData) {
                console.error('[SaveSystem] Failed to serialize player entity');
                return false;
            }
            
            // 创建存档数据
            const saveData: SaveData = {
                version: this.currentVersion,
                timestamp: Date.now(),
                entities: [entityData],
            };
            
            // 序列化为 JSON
            const jsonString = JSON.stringify(saveData);
            
            // 保存到 localStorage
            const key = this.getSaveKey(slotIndex);
            this.setItem(key, jsonString);
            
            return true;
        } catch (error) {
            console.error('[SaveSystem] Failed to save game:', error);
            return false;
        }
    }
    
    /**
     * 读取游戏状态（重建 World）
     * ⚠️ 注意：读档时会创建新的 World，而不是修补现有状态
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 新的 World 实例，如果读档失败返回 null
     */
    loadGame(slotIndex: number): World | null {
        if (slotIndex < 0 || slotIndex > 9) {
            console.error(`[SaveSystem] Invalid slot index: ${slotIndex}. Must be between 0 and 9.`);
            return null;
        }
        
        if (!this.configLoader) {
            console.error('[SaveSystem] ConfigLoader not set');
            return null;
        }
        
        try {
            // 从 localStorage 读取存档数据
            const key = this.getSaveKey(slotIndex);
            const jsonString = this.getItem(key);
            if (!jsonString) {
                console.error(`[SaveSystem] Save file not found for slot ${slotIndex}`);
                return null;
            }
            
            // 解析 JSON
            const saveData: SaveData = JSON.parse(jsonString);
            
            // 严格校验版本（不做隐式兼容）
            if (saveData.version !== this.currentVersion) {
                // 版本不匹配时直接抛出错误，不进行任何转换或兼容性处理
                const error = new Error(`Version mismatch. Save version: ${saveData.version}, Current version: ${this.currentVersion}`);
                console.error('[SaveSystem]', error.message);
                throw error; // 直接抛出，不捕获
            }
            
            // 创建新的 World（不修改现有 World）
            const newWorld = new World({
                debug: false,
                initialEntityPoolSize: 1000,
                componentPoolSize: 100
            });
            
            // 从存档数据重建实体
            for (const entityData of saveData.entities) {
                // 创建新实体（EntityId 重新生成）
                const entity = newWorld.createEntity(entityData.name);
                
                // 恢复组件
                for (const componentData of entityData.components) {
                    this.deserializeComponent(entity, componentData);
                }
            }
            
            return newWorld;
        } catch (error) {
            // 如果是版本不匹配错误，直接抛出
            if (error instanceof Error && error.message.includes('Version mismatch')) {
                throw error;
            }
            // 其他错误才返回 null
            console.error('[SaveSystem] Failed to load game:', error);
            return null;
        }
    }
    
    /**
     * 删除存档
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否成功删除
     */
    deleteSave(slotIndex: number): boolean {
        if (slotIndex < 0 || slotIndex > 9) {
            console.error(`[SaveSystem] Invalid slot index: ${slotIndex}. Must be between 0 and 9.`);
            return false;
        }
        
        try {
            const key = this.getSaveKey(slotIndex);
            this.removeItem(key);
            return true;
        } catch (error) {
            console.error('[SaveSystem] Failed to delete save:', error);
            return false;
        }
    }
    
    /**
     * 检查存档是否存在
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 是否存在
     */
    hasSave(slotIndex: number): boolean {
        if (slotIndex < 0 || slotIndex > 9) {
            return false;
        }
        
        const key = this.getSaveKey(slotIndex);
        return this.hasItem(key);
    }
    
    /**
     * 获取存档信息（用于显示存档列表）
     * @param slotIndex 存档槽位索引（0-9）
     * @returns 存档信息，如果不存在返回 null
     */
    getSaveInfo(slotIndex: number): SaveInfo | null {
        if (slotIndex < 0 || slotIndex > 9) {
            return null;
        }
        
        const key = this.getSaveKey(slotIndex);
        const jsonString = this.getItem(key);
        if (!jsonString) {
            return null;
        }
        
        try {
            const saveData: SaveData = JSON.parse(jsonString);
            return {
                slotIndex,
                timestamp: saveData.timestamp,
                version: saveData.version,
                gameTime: saveData.gameTime,
                entityName: saveData.entities[0]?.name,
            };
        } catch (error) {
            console.error('[SaveSystem] Failed to parse save info:', error);
            return null;
        }
    }
    
    /**
     * 查找玩家实体
     * 当前阶段：只保存玩家实体
     */
    private findPlayerEntity(): Entity | null {
        // 方案 1：根据实体名称
        const queryByName = this.world.createQuery({ all: [] });
        for (const entity of queryByName.getEntities()) {
            if (entity.name === 'Player') {
                return entity;
            }
        }
        
        // 方案 2：根据组件组合（更精确）
        // 玩家通常同时有 StatsComponent 和 LevelExperienceComponent
        const query = this.world.createQuery({
            all: [StatsComponent, LevelExperienceComponent]
        });
        
        const entities = query.getEntities();
        if (entities.length > 0) {
            // 优先选择有 InventoryComponent 的实体
            for (const entity of entities) {
                if (entity.getComponent(InventoryComponent)) {
                    return entity;
                }
            }
            // 如果没有，返回第一个
            return entities[0];
        }
        
        return null;
    }
    
    /**
     * 判断组件是否需要保存
     */
    private shouldSaveComponent(componentType: string): boolean {
        // 检查是否在白名单中
        if (SAVABLE_COMPONENTS.has(componentType)) {
            return true;
        }
        
        // 检查是否在临时组件列表中（不保存）
        if (TEMPORARY_COMPONENTS.has(componentType)) {
            return false;
        }
        
        // 默认不保存未知组件
        return false;
    }
    
    /**
     * 序列化实体
     */
    private serializeEntity(entity: Entity): EntitySaveData | null {
        const components: ComponentSaveData[] = [];
        
        // 遍历实体的所有组件
        // 注意：这里需要根据 @bl-framework/ecs 的实际 API 来获取组件列表
        // 假设可以通过某种方式获取所有组件类型
        const componentTypes = this.getEntityComponentTypes(entity);
        
        for (const componentType of componentTypes) {
            // 检查是否需要保存
            if (!this.shouldSaveComponent(componentType)) {
                continue;
            }
            
            // 获取组件
            const component = this.getComponentByName(entity, componentType);
            if (!component) {
                continue;
            }
            
            // 获取序列化器
            const serializer = this.serializers.get(componentType);
            if (!serializer) {
                // 如果没有序列化器，尝试自动序列化（仅用于基础组件）
                console.warn(`[SaveSystem] No serializer for component type: ${componentType}`);
                continue;
            }
            
            // 序列化组件
            try {
                const data = serializer.serialize(component);
                components.push({
                    type: componentType,
                    data: data,
                });
            } catch (error) {
                console.error(`[SaveSystem] Failed to serialize component ${componentType}:`, error);
            }
        }
        
        return {
            name: entity.name,
            components: components,
        };
    }
    
    /**
     * 反序列化组件
     */
    private deserializeComponent(entity: Entity, componentData: ComponentSaveData): void {
        const serializer = this.serializers.get(componentData.type);
        if (!serializer) {
            console.warn(`[SaveSystem] No serializer for component type: ${componentData.type}`);
            return;
        }
        
        if (!this.configLoader) {
            console.error('[SaveSystem] ConfigLoader not set');
            return;
        }
        
        try {
            serializer.deserialize(entity, componentData.data, this.configLoader);
        } catch (error) {
            console.error(`[SaveSystem] Failed to deserialize component ${componentData.type}:`, error);
        }
    }
    
    /**
     * 获取实体的组件类型列表
     * 注意：这里需要根据 @bl-framework/ecs 的实际 API 来实现
     */
    private getEntityComponentTypes(entity: Entity): string[] {
        const types: string[] = [];
        
        // 根据已知的组件类型检查
        const componentTypes = [
            'Transform', 'HP', 'Stats', 'LevelExperience',
            'Inventory', 'Equipment', 'BuffList', 'SkillSlots',
            'Faction', 'Collider', 'ViewLink', 'AnimState',
        ];
        
        for (const type of componentTypes) {
            if (this.getComponentByName(entity, type)) {
                types.push(type);
            }
        }
        
        return types;
    }
    
    /**
     * 根据组件名称获取组件
     */
    private getComponentByName(entity: Entity, componentName: string): Component | null {
        // 根据组件名称映射到组件类型
        const componentMap: Record<string, any> = {
            'Transform': TransformComponent,
            'HP': HPComponent,
            'Stats': StatsComponent,
            'LevelExperience': LevelExperienceComponent,
            'Inventory': InventoryComponent,
            'Equipment': EquipmentComponent,
            'BuffList': BuffListComponent,
            'SkillSlots': SkillSlotsComponent,
            'Faction': FactionComponent,
            'Collider': ColliderComponent,
            'ViewLink': ViewLinkComponent,
            'AnimState': AnimStateComponent,
        };
        
        const ComponentType = componentMap[componentName];
        if (!ComponentType) {
            return null;
        }
        
        return entity.getComponent(ComponentType);
    }
    
    /**
     * 获取存档键名
     */
    private getSaveKey(slotIndex: number): string {
        return `save_${slotIndex}`;
    }
    
    /**
     * localStorage 操作（抽象层，支持未来扩展）
     */
    private setItem(key: string, value: string): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        } else if (typeof sys !== 'undefined' && sys?.localStorage) {
            sys.localStorage.setItem(key, value);
        } else {
            throw new Error('[SaveSystem] localStorage is not available');
        }
    }
    
    private getItem(key: string): string | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        } else if (typeof sys !== 'undefined' && sys?.localStorage) {
            return sys.localStorage.getItem(key);
        } else {
            throw new Error('[SaveSystem] localStorage is not available');
        }
    }
    
    private removeItem(key: string): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        } else if (typeof sys !== 'undefined' && sys?.localStorage) {
            sys.localStorage.removeItem(key);
        } else {
            throw new Error('[SaveSystem] localStorage is not available');
        }
    }
    
    private hasItem(key: string): boolean {
        return this.getItem(key) !== null;
    }
    
    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有操作通过外部调用触发
    }
}
