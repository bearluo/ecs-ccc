/**
 * 掉落系统
 * 
 * 处理敌人死亡时的物品掉落逻辑
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 事件驱动，监听死亡事件
 * - 与 InventorySystem 集成（掉落物品添加到背包）
 * - 与 UpgradeSystem 集成（掉落经验值）
 * 
 * 设计决策：直接掉落系统（死亡时直接处理），事件驱动，监听死亡事件
 * 参考文档：memory-bank/creative/creative-loot-system.md
 */

import { System, system, Entity, Handle } from '@bl-framework/ecs';
import { TransformComponent } from '../components/Transform';
import { LevelExperienceComponent } from '../components/LevelExperience';
import { ConfigLoader } from '../../ConfigLoader';
import { InventorySystem } from './InventorySystem';
import { UpgradeSystem } from './UpgradeSystem';
import { EventBus } from '../../bridge/EventBus';
import { LootTable, LootEntry } from '../../data/configs/loot';

@system({ priority: 7 })  // 在 DeathSystem 之后
export class LootSystem extends System {
    private configLoader?: ConfigLoader;
    private inventorySystem?: InventorySystem;
    private upgradeSystem?: UpgradeSystem;
    private eventBus?: EventBus;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    setInventorySystem(inventorySystem: InventorySystem): void {
        this.inventorySystem = inventorySystem;
    }

    setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
        this.upgradeSystem = upgradeSystem;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
        
        // 订阅死亡事件
        this.eventBus.subscribe('EntityDeath', (event: any) => {
            this.onEntityDeath(event);
        });
    }

    /**
     * 处理实体死亡事件
     */
    private onEntityDeath(event: any): void {
        const deadEntity = this.world.getEntityByHandle(event.handle);
        if (!deadEntity) return;

        // 获取击杀者（从事件中获取）
        const killerHandle = event.killerHandle;
        if (!killerHandle) return;

        const killerEntity = this.world.getEntityByHandle(killerHandle);
        if (!killerEntity) return;

        // 处理掉落
        this.dropLoot(deadEntity, killerEntity);
    }

    /**
     * 掉落物品（外部调用）
     * @param deadEntity 死亡实体
     * @param killerEntity 击杀者实体
     */
    dropLoot(deadEntity: Entity, killerEntity: Entity): void {
        if (!this.configLoader) return;

        // 获取掉落表配置（根据实体类型）
        const lootTable = this.getLootTable(deadEntity);
        if (!lootTable) return;

        // 处理掉落表中的每个物品
        for (const lootEntry of lootTable.items) {
            // 掉落概率检查
            if (Math.random() > lootEntry.probability) {
                continue;
            }

            // 掉落数量（支持随机范围）
            const count = this.getLootCount(lootEntry);

            // 根据掉落类型处理
            switch (lootEntry.type) {
                case 'item':
                case 'equipment':
                    if (lootEntry.itemId) {
                        this.dropItem(killerEntity, lootEntry.itemId, count);
                    }
                    break;
                case 'experience':
                    if (lootEntry.value !== undefined) {
                        this.dropExperience(killerEntity, lootEntry.value * count);
                    }
                    break;
            }
        }
    }

    /**
     * 掉落物品（添加到背包）
     */
    private dropItem(killerEntity: Entity, itemId: string, count: number): void {
        if (this.inventorySystem) {
            this.inventorySystem.addItem(killerEntity, itemId, count);
        }
    }

    /**
     * 掉落经验值
     */
    private dropExperience(killerEntity: Entity, amount: number): void {
        if (this.upgradeSystem) {
            this.upgradeSystem.addExperience(killerEntity, amount, 'kill');
        }
    }

    /**
     * 获取掉落表（根据实体类型）
     */
    private getLootTable(entity: Entity): LootTable | null {
        if (!this.configLoader) return null;

        // 可以从实体类型、配置等获取
        // 示例：根据实体名称或类型
        // 这里简化处理，可以根据实体的某个组件或名称来确定掉落表
        const entityType = entity.name || 'enemy_basic';
        
        // 如果实体有 LevelExperienceComponent，可以根据等级调整掉落表
        const levelExp = entity.getComponent(LevelExperienceComponent);
        if (levelExp && levelExp.level > 10) {
            // 高级敌人使用精英掉落表
            return this.configLoader.getLootTable('enemy_elite');
        }
        
        return this.configLoader.getLootTable(entityType);
    }

    /**
     * 获取掉落数量（支持随机范围）
     */
    private getLootCount(lootEntry: LootEntry): number {
        if (lootEntry.countMin !== undefined && lootEntry.countMax !== undefined) {
            return Math.floor(Math.random() * (lootEntry.countMax - lootEntry.countMin + 1)) + lootEntry.countMin;
        }
        return lootEntry.count || 1;
    }

    onUpdate(dt: number): void {
        // 事件驱动的系统，不需要主动查询
    }
}
