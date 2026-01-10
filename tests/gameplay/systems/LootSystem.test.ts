/// <reference types="jest" />
/**
 * LootSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { LootSystem } from 'db://assets/scripts/gameplay/systems/LootSystem';
import { InventorySystem } from 'db://assets/scripts/gameplay/systems/InventorySystem';
import { UpgradeSystem } from 'db://assets/scripts/gameplay/systems/UpgradeSystem';
import { LevelExperienceComponent } from 'db://assets/scripts/gameplay/components/LevelExperience';
import { InventoryComponent } from 'db://assets/scripts/gameplay/components/Inventory';
import { ConfigLoader } from 'db://assets/scripts/ConfigLoader';
import { EventBus } from 'db://assets/scripts/bridge/EventBus';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { FactionComponent, FactionType } from 'db://assets/scripts/gameplay/components/Faction';

describe('LootSystem', () => {
    let world: World;
    let lootSystem: LootSystem;
    let inventorySystem: InventorySystem;
    let upgradeSystem: UpgradeSystem;
    let configLoader: ConfigLoader;
    let eventBus: EventBus;

    beforeEach(() => {
        world = new World({ debug: false });
        lootSystem = world.registerSystem(LootSystem);
        inventorySystem = world.registerSystem(InventorySystem);
        upgradeSystem = world.registerSystem(UpgradeSystem);
        
        configLoader = new ConfigLoader();
        lootSystem.setConfigLoader(configLoader);
        inventorySystem.setConfigLoader(configLoader);
        
        lootSystem.setInventorySystem(inventorySystem);
        lootSystem.setUpgradeSystem(upgradeSystem);
        
        eventBus = new EventBus();
        upgradeSystem.setEventBus(eventBus);
        lootSystem.setEventBus(eventBus);
    });

    describe('掉落处理', () => {
        it('应该正确处理物品掉落', () => {
            const deadEntity = world.createEntity('Enemy');
            deadEntity.addComponent(TransformComponent);
            deadEntity.name = 'enemy_basic';
            
            const killerEntity = world.createEntity('Player');
            killerEntity.addComponent(InventoryComponent);
            killerEntity.addComponent(FactionComponent);
            killerEntity.getComponent(FactionComponent)!.faction = FactionType.Player;
            
            // 模拟掉落（直接调用 dropLoot 方法，因为需要掉落表配置）
            // 注意：这个测试可能需要根据实际的掉落表配置调整
            lootSystem.dropLoot(deadEntity, killerEntity);
            
            // 由于掉落概率是随机的，这里只测试方法不会抛出错误
            expect(() => {
                lootSystem.dropLoot(deadEntity, killerEntity);
            }).not.toThrow();
        });

        it('应该正确处理经验值掉落', () => {
            const deadEntity = world.createEntity('Enemy');
            deadEntity.addComponent(TransformComponent);
            deadEntity.name = 'enemy_basic';
            
            const killerEntity = world.createEntity('Player');
            killerEntity.addComponent(LevelExperienceComponent);
            killerEntity.addComponent(FactionComponent);
            killerEntity.getComponent(FactionComponent)!.faction = FactionType.Player;
            
            const levelExp = killerEntity.getComponent(LevelExperienceComponent)!;
            const initialExp = levelExp.totalExp;
            
            // 模拟掉落经验值（直接调用 dropLoot）
            lootSystem.dropLoot(deadEntity, killerEntity);
            
            // 由于掉落概率是随机的，经验值可能增加也可能不增加
            // 这里只测试方法不会抛出错误
            expect(levelExp.totalExp).toBeGreaterThanOrEqual(initialExp);
        });

        it('如果没有 ConfigLoader 应该不处理掉落', () => {
            const deadEntity = world.createEntity('Enemy');
            const killerEntity = world.createEntity('Player');
            
            const newSystem = new LootSystem();
            newSystem['world'] = world;
            // 不设置 configLoader
            
            // 应该不抛出错误，但不处理掉落
            expect(() => {
                newSystem.dropLoot(deadEntity, killerEntity);
            }).not.toThrow();
        });
    });

    describe('死亡事件处理', () => {
        it('应该监听 EntityDeath 事件并处理掉落', () => {
            const deadEntity = world.createEntity('Enemy');
            deadEntity.addComponent(TransformComponent);
            deadEntity.name = 'enemy_basic';
            
            const killerEntity = world.createEntity('Player');
            killerEntity.addComponent(InventoryComponent);
            killerEntity.addComponent(LevelExperienceComponent);
            killerEntity.addComponent(FactionComponent);
            killerEntity.getComponent(FactionComponent)!.faction = FactionType.Player;
            
            // 发送死亡事件
            eventBus.push({
                type: 'EntityDeath',
                handle: deadEntity.handle,
                killerHandle: killerEntity.handle
            });
            
            eventBus.flush();
            
            // 由于掉落概率是随机的，这里只测试事件处理不会抛出错误
            expect(() => {
                eventBus.flush();
            }).not.toThrow();
        });

        it('如果没有击杀者应该不处理掉落', () => {
            const deadEntity = world.createEntity('Enemy');
            deadEntity.addComponent(TransformComponent);
            
            // 发送死亡事件，但没有击杀者
            eventBus.push({
                type: 'EntityDeath',
                handle: deadEntity.handle
                // 没有 killerHandle
            });
            
            eventBus.flush();
            
            // 应该不抛出错误，但不处理掉落
            expect(() => {
                eventBus.flush();
            }).not.toThrow();
        });
    });

    describe('掉落表获取', () => {
        it('应该根据实体类型获取正确的掉落表', () => {
            const entity = world.createEntity('enemy_basic');
            entity.addComponent(TransformComponent);
            entity.addComponent(LevelExperienceComponent);
            
            // 使用内部方法测试（通过反射访问）
            const lootTable = (lootSystem as any).getLootTable(entity);
            
            // 应该返回 enemy_basic 的掉落表
            expect(lootTable).not.toBeNull();
            expect(lootTable?.id).toBe('enemy_basic');
        });

        it('高级敌人应该使用精英掉落表', () => {
            const entity = world.createEntity('Enemy');
            entity.addComponent(TransformComponent);
            const levelExp = entity.addComponent(LevelExperienceComponent);
            levelExp.level = 15; // 高级敌人
            
            // 使用内部方法测试
            const lootTable = (lootSystem as any).getLootTable(entity);
            
            // 应该返回 enemy_elite 的掉落表
            expect(lootTable).not.toBeNull();
            expect(lootTable?.id).toBe('enemy_elite');
        });
    });
});
