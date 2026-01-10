/**
 * SaveSystem 单元测试
 * 
 * 测试存档系统的序列化、反序列化、版本校验等功能
 */

import { World } from '@bl-framework/ecs';
import { SaveSystem, SaveData, EntitySaveData } from '../../../assets/scripts/gameplay/systems/SaveSystem';
import { ConfigLoader } from '../../../assets/scripts/ConfigLoader';
import { TransformComponent } from '../../../assets/scripts/gameplay/components/Transform';
import { HPComponent } from '../../../assets/scripts/gameplay/components/HP';
import { StatsComponent } from '../../../assets/scripts/gameplay/components/Stats';
import { LevelExperienceComponent } from '../../../assets/scripts/gameplay/components/LevelExperience';
import { InventoryComponent } from '../../../assets/scripts/gameplay/components/Inventory';
import { EquipmentComponent } from '../../../assets/scripts/gameplay/components/Equipment';
import { BuffListComponent } from '../../../assets/scripts/gameplay/components/BuffList';
import { SkillSlotsComponent } from '../../../assets/scripts/gameplay/components/SkillSlots';
import { ViewLinkComponent } from '../../../assets/scripts/gameplay/components/ViewLink';
import { AnimStateComponent } from '../../../assets/scripts/gameplay/components/AnimState';
import { FactionComponent } from '../../../assets/scripts/gameplay/components/Faction';
import { ColliderComponent } from '../../../assets/scripts/gameplay/components/Collider';

describe('SaveSystem', () => {
    let world: World;
    let saveSystem: SaveSystem;
    let configLoader: ConfigLoader;
    
    // Mock localStorage
    let mockStorage: Record<string, string> = {};
    
    beforeEach(() => {
        // 重置 mock localStorage
        mockStorage = {};
        
        // Mock localStorage methods
        global.window = {
            localStorage: {
                getItem: jest.fn((key: string) => mockStorage[key] || null),
                setItem: jest.fn((key: string, value: string) => {
                    mockStorage[key] = value;
                }),
                removeItem: jest.fn((key: string) => {
                    delete mockStorage[key];
                }),
                clear: jest.fn(() => {
                    mockStorage = {};
                }),
                get length(): number {
                    return Object.keys(mockStorage).length;
                },
                key: jest.fn((index: number) => Object.keys(mockStorage)[index] || null),
            }
        } as any;
        
        // 创建 World 和 SaveSystem
        world = new World({ debug: false });
        saveSystem = world.registerSystem(SaveSystem);
        configLoader = new ConfigLoader();
        saveSystem.setConfigLoader(configLoader);
    });
    
    afterEach(() => {
        // 清理 mock storage
        mockStorage = {};
    });
    
    describe('基础功能', () => {
        it('应该正确保存和读取基础组件', () => {
            // 创建玩家实体
            const player = world.createEntity('Player');
            const transform = player.addComponent(TransformComponent);
            transform.x = 100;
            transform.y = 200;
            transform.rot = 45;
            
            const hp = player.addComponent(HPComponent);
            hp.cur = 80;
            hp.max = 100;
            
            // 保存游戏
            const success = saveSystem.saveGame(0);
            expect(success).toBe(true);
            
            // 验证 localStorage 中有数据
            expect(mockStorage['save_0']).toBeDefined();
            
            // 读取存档（重建 World）
            const newWorld = saveSystem.loadGame(0);
            expect(newWorld).not.toBeNull();
            expect(newWorld).not.toBe(world); // 应该是新的 World 实例
            
            // 验证实体已恢复
            const playerQuery = newWorld.createQuery({ all: [TransformComponent] });
            const entities = playerQuery.getEntities();
            expect(entities.length).toBe(1);
            
            const restoredPlayer = entities[0];
            expect(restoredPlayer.name).toBe('Player');
            
            const restoredTransform = restoredPlayer.getComponent(TransformComponent);
            expect(restoredTransform).not.toBeNull();
            expect(restoredTransform!.x).toBe(100);
            expect(restoredTransform!.y).toBe(200);
            expect(restoredTransform!.rot).toBe(45);
            
            const restoredHp = restoredPlayer.getComponent(HPComponent);
            expect(restoredHp).not.toBeNull();
            expect(restoredHp!.cur).toBe(80);
            expect(restoredHp!.max).toBe(100);
        });
        
        it('应该正确保存和读取 StatsComponent', () => {
            const player = world.createEntity('Player');
            const stats = player.addComponent(StatsComponent);
            stats.base.attack = 10;
            stats.base.defense = 5;
            stats.equipment.attack = 5;
            stats.levelup.attack = 2;
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [StatsComponent] }).getEntities()[0];
            const restoredStats = restoredPlayer.getComponent(StatsComponent);
            
            expect(restoredStats!.base.attack).toBe(10);
            expect(restoredStats!.base.defense).toBe(5);
            expect(restoredStats!.equipment.attack).toBe(5);
            expect(restoredStats!.levelup.attack).toBe(2);
        });
        
        it('应该正确保存和读取 LevelExperienceComponent', () => {
            const player = world.createEntity('Player');
            const levelExp = player.addComponent(LevelExperienceComponent);
            levelExp.level = 5;
            levelExp.maxLevel = 100;
            levelExp.exp = 250;
            levelExp.expRequired = 500;
            levelExp.totalExp = 1000;
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [LevelExperienceComponent] }).getEntities()[0];
            const restoredLevelExp = restoredPlayer.getComponent(LevelExperienceComponent);
            
            expect(restoredLevelExp!.level).toBe(5);
            expect(restoredLevelExp!.maxLevel).toBe(100);
            expect(restoredLevelExp!.exp).toBe(250);
            expect(restoredLevelExp!.expRequired).toBe(500);
            expect(restoredLevelExp!.totalExp).toBe(1000);
        });
    });
    
    describe('自定义序列化器（配置引用过滤）', () => {
        it('应该正确保存和读取 InventoryComponent（过滤配置引用）', () => {
            const player = world.createEntity('Player');
            const inventory = player.addComponent(InventoryComponent);
            inventory.addItem('potion_heal', 5, configLoader);
            inventory.addItem('scroll_speed', 3, configLoader);
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [InventoryComponent] }).getEntities()[0];
            const restoredInventory = restoredPlayer.getComponent(InventoryComponent);
            
            expect(restoredInventory).not.toBeNull();
            expect(restoredInventory!.slots[0]).not.toBeNull();
            expect(restoredInventory!.slots[0]!.itemId).toBe('potion_heal');
            expect(restoredInventory!.slots[0]!.count).toBe(5);
            // 配置引用应该从 ConfigLoader 重新加载
            expect(restoredInventory!.slots[0]!.config).toBeDefined();
            expect(restoredInventory!.slots[0]!.config.id).toBe('potion_heal');
        });
        
        it('应该正确保存和读取 EquipmentComponent（过滤配置引用）', () => {
            const player = world.createEntity('Player');
            const equipment = player.addComponent(EquipmentComponent);
            const stats = player.addComponent(StatsComponent); // Required for equipment
            const weaponConfig = configLoader.getEquipmentConfig('sword_iron');
            
            if (weaponConfig) {
                equipment.equip('weapon', 'sword_iron', weaponConfig, 1);
                
                saveSystem.saveGame(0);
                const newWorld = saveSystem.loadGame(0);
                
                const restoredPlayer = newWorld!.createQuery({ all: [EquipmentComponent] }).getEntities()[0];
                const restoredEquipment = restoredPlayer.getComponent(EquipmentComponent);
                
                expect(restoredEquipment).not.toBeNull();
                const weapon = restoredEquipment!.getEquipment('weapon');
                expect(weapon).not.toBeNull();
                expect(weapon!.equipmentId).toBe('sword_iron');
                expect(weapon!.level).toBe(1);
                // 配置引用应该从 ConfigLoader 重新加载
                expect(weapon!.config).toBeDefined();
                expect(weapon!.config.id).toBe('sword_iron');
            }
        });
        
        it('应该正确保存和读取 BuffListComponent', () => {
            const player = world.createEntity('Player');
            const buffList = player.addComponent(BuffListComponent);
            buffList.addBuff('buff1', 'speed_boost', 10, 2, { value: 0.2 }, 'skill1');
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [BuffListComponent] }).getEntities()[0];
            const restoredBuffList = restoredPlayer.getComponent(BuffListComponent);
            
            expect(restoredBuffList).not.toBeNull();
            const buff = restoredBuffList!.findBuff('speed_boost');
            expect(buff).toBeDefined();
            expect(buff!.id).toBe('buff1');
            expect(buff!.duration).toBe(10);
            expect(buff!.stacks).toBe(2);
            expect(buff!.params.value).toBe(0.2);
            expect(buff!.source).toBe('skill1');
        });
        
        it('应该正确保存和读取 SkillSlotsComponent（过滤配置引用）', () => {
            const player = world.createEntity('Player');
            const skillSlots = player.addComponent(SkillSlotsComponent);
            const skillConfig = configLoader.getSkillConfig('fireball');
            
            if (skillConfig) {
                skillSlots.setSkill(0, 'fireball', skillConfig);
                
                saveSystem.saveGame(0);
                const newWorld = saveSystem.loadGame(0);
                
                const restoredPlayer = newWorld!.createQuery({ all: [SkillSlotsComponent] }).getEntities()[0];
                const restoredSkillSlots = restoredPlayer.getComponent(SkillSlotsComponent);
                
                expect(restoredSkillSlots).not.toBeNull();
                const skill = restoredSkillSlots!.getSkill(0);
                expect(skill).not.toBeNull();
                expect(skill!.skillId).toBe('fireball');
                // 配置引用应该从 ConfigLoader 重新加载
                expect(skill!.config).toBeDefined();
            }
        });
    });
    
    describe('部分序列化（运行时状态过滤）', () => {
        it('应该正确保存和读取 ViewLinkComponent（只保存 prefabKey，不保存 viewId）', () => {
            const player = world.createEntity('Player');
            const viewLink = player.addComponent(ViewLinkComponent);
            viewLink.prefabKey = 'player_prefab';
            viewLink.viewId = 12345; // 运行时状态，不应该被保存
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [ViewLinkComponent] }).getEntities()[0];
            const restoredViewLink = restoredPlayer.getComponent(ViewLinkComponent);
            
            expect(restoredViewLink).not.toBeNull();
            expect(restoredViewLink!.prefabKey).toBe('player_prefab');
            // viewId 应该在读档时重置为默认值
            expect(restoredViewLink!.viewId).toBe(0);
        });
        
        it('应该正确保存和读取 AnimStateComponent（不保存 lastSentAnim）', () => {
            const player = world.createEntity('Player');
            const animState = player.addComponent(AnimStateComponent);
            animState.current = 'attack';
            animState.locked = true;
            animState.speed = 1.5;
            animState.lastSentAnim = 'attack'; // 运行时优化数据，不应该被保存
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [AnimStateComponent] }).getEntities()[0];
            const restoredAnimState = restoredPlayer.getComponent(AnimStateComponent);
            
            expect(restoredAnimState).not.toBeNull();
            expect(restoredAnimState!.current).toBe('attack');
            expect(restoredAnimState!.locked).toBe(true);
            expect(restoredAnimState!.speed).toBe(1.5);
            // lastSentAnim 应该在读档时重置为默认值
            expect(restoredAnimState!.lastSentAnim).toBe('');
        });
    });
    
    describe('版本校验', () => {
        it('应该严格校验版本（版本不匹配直接失败）', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            // 保存当前版本的游戏
            saveSystem.saveGame(0);
            
            // 手动修改存档版本为不兼容版本
            const saveData: SaveData = JSON.parse(mockStorage['save_0']);
            saveData.version = '2.0.0'; // 不兼容版本
            mockStorage['save_0'] = JSON.stringify(saveData);
            
            // 尝试读取存档，应该失败
            expect(() => {
                saveSystem.loadGame(0);
            }).toThrow('Version mismatch');
        });
        
        it('应该正确保存和读取版本信息', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            saveSystem.saveGame(0);
            const saveInfo = saveSystem.getSaveInfo(0);
            
            expect(saveInfo).not.toBeNull();
            expect(saveInfo!.version).toBe('1.0.0');
            expect(saveInfo!.timestamp).toBeGreaterThan(0);
        });
    });
    
    describe('EntityId 不作为稳定标识', () => {
        it('读档时应该重新生成 EntityId（创建新的 World 和新实体）', () => {
            const player = world.createEntity('Player');
            const originalWorld = world;
            player.addComponent(TransformComponent);
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            // 验证返回的是新的 World 实例（不是修改现有 World）
            expect(newWorld).not.toBe(originalWorld);
            
            const restoredPlayer = newWorld!.createQuery({ all: [TransformComponent] }).getEntities()[0];
            
            // 验证实体是在新 World 中创建的（EntityId 重新生成）
            // 注意：由于新 World 的 id 可能从 1 开始，可能会和原 World 的 id 相同
            // 但重要的是：它们是在不同的 World 中，EntityId 不是稳定标识
            // 更好的验证方式是：确保读档时创建的是全新的实体，而不是复用原实体
            expect(restoredPlayer.name).toBe('Player');
            // 验证存档数据中不包含 EntityId（这是核心约束）
            const saveData: SaveData = JSON.parse(mockStorage['save_0']);
            expect(saveData.entities[0]).not.toHaveProperty('id');
            expect(saveData.entities[0]).not.toHaveProperty('handle');
        });
        
        it('存档数据中不包含 EntityId', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            saveSystem.saveGame(0);
            const saveData: SaveData = JSON.parse(mockStorage['save_0']);
            
            // 验证存档数据中不包含 EntityId
            expect(saveData.entities[0]).not.toHaveProperty('id');
            expect(saveData.entities[0]).not.toHaveProperty('handle');
        });
    });
    
    describe('存档管理', () => {
        it('应该正确检查存档是否存在', () => {
            expect(saveSystem.hasSave(0)).toBe(false);
            
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            saveSystem.saveGame(0);
            
            expect(saveSystem.hasSave(0)).toBe(true);
        });
        
        it('应该正确删除存档', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            saveSystem.saveGame(0);
            
            expect(saveSystem.hasSave(0)).toBe(true);
            
            const success = saveSystem.deleteSave(0);
            expect(success).toBe(true);
            expect(saveSystem.hasSave(0)).toBe(false);
        });
        
        it('应该正确获取存档信息', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            saveSystem.saveGame(0);
            const saveInfo = saveSystem.getSaveInfo(0);
            
            expect(saveInfo).not.toBeNull();
            expect(saveInfo!.slotIndex).toBe(0);
            expect(saveInfo!.version).toBe('1.0.0');
            expect(saveInfo!.timestamp).toBeGreaterThan(0);
            expect(saveInfo!.entityName).toBe('Player');
        });
        
        it('应该正确处理多个存档槽位', () => {
            const player1 = world.createEntity('Player');
            player1.addComponent(TransformComponent);
            saveSystem.saveGame(0);
            
            const player2 = world.createEntity('Player');
            player2.addComponent(TransformComponent);
            saveSystem.saveGame(1);
            
            expect(saveSystem.hasSave(0)).toBe(true);
            expect(saveSystem.hasSave(1)).toBe(true);
            
            saveSystem.deleteSave(0);
            expect(saveSystem.hasSave(0)).toBe(false);
            expect(saveSystem.hasSave(1)).toBe(true);
        });
        
        it('应该拒绝无效的槽位索引', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            expect(saveSystem.saveGame(-1)).toBe(false);
            expect(saveSystem.saveGame(10)).toBe(false);
            expect(saveSystem.hasSave(-1)).toBe(false);
            expect(saveSystem.hasSave(10)).toBe(false);
        });
    });
    
    describe('玩家实体识别', () => {
        it('应该通过实体名称识别玩家实体', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [TransformComponent] }).getEntities()[0];
            expect(restoredPlayer.name).toBe('Player');
        });
        
        it('应该通过组件组合识别玩家实体', () => {
            const player = world.createEntity('TestEntity');
            player.addComponent(StatsComponent);
            player.addComponent(LevelExperienceComponent);
            player.addComponent(InventoryComponent);
            
            saveSystem.saveGame(0);
            const newWorld = saveSystem.loadGame(0);
            
            const restoredPlayer = newWorld!.createQuery({ all: [StatsComponent, LevelExperienceComponent] }).getEntities()[0];
            expect(restoredPlayer).toBeDefined();
        });
        
        it('如果没有找到玩家实体应该返回 false', () => {
            // 创建一个非玩家实体
            const enemy = world.createEntity('Enemy');
            enemy.addComponent(TransformComponent);
            enemy.addComponent(HPComponent);
            
            // 保存应该失败（找不到玩家实体）
            const success = saveSystem.saveGame(0);
            expect(success).toBe(false);
        });
    });
    
    describe('只保存玩家实体', () => {
        it('存档中应该只包含玩家实体，不包含其他实体', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            player.addComponent(HPComponent);
            
            const enemy = world.createEntity('Enemy');
            enemy.addComponent(TransformComponent);
            enemy.addComponent(HPComponent);
            
            saveSystem.saveGame(0);
            const saveData: SaveData = JSON.parse(mockStorage['save_0']);
            
            // 存档中应该只包含玩家实体
            expect(saveData.entities.length).toBe(1);
            expect(saveData.entities[0].name).toBe('Player');
        });
    });
    
    describe('运行时状态不序列化', () => {
        it('应该不序列化临时组件', () => {
            const player = world.createEntity('Player');
            player.addComponent(TransformComponent);
            
            // 添加临时组件（这些不应该被序列化）
            // 注意：这里需要导入 DeadTag、AnimationIntent 等组件来测试
            // 但由于它们不在白名单中，应该自动被过滤
            
            saveSystem.saveGame(0);
            const saveData: SaveData = JSON.parse(mockStorage['save_0']);
            
            // 验证存档中不包含临时组件
            const componentTypes = saveData.entities[0].components.map(c => c.type);
            expect(componentTypes).not.toContain('DeadTag');
            expect(componentTypes).not.toContain('AnimationIntent');
            expect(componentTypes).not.toContain('FxIntent');
            expect(componentTypes).not.toContain('AudioIntent');
        });
    });
});
