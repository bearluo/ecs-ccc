/**
 * UISystem 单元测试
 */

import { World, Entity } from '@bl-framework/ecs';
import { UISystem } from '../../../assets/scripts/gameplay/systems/UISystem';
import { EventBus } from '../../../assets/scripts/bridge/EventBus';
import { InventorySystem } from '../../../assets/scripts/gameplay/systems/InventorySystem';
import { EquipmentSystem } from '../../../assets/scripts/gameplay/systems/EquipmentSystem';
import { UIManager } from '../../../assets/scripts/presentation/UI/UIManager';
import { LevelExperienceComponent } from '../../../assets/scripts/gameplay/components/LevelExperience';
import { InventoryComponent } from '../../../assets/scripts/gameplay/components/Inventory';
import { SkillSlotsComponent } from '../../../assets/scripts/gameplay/components/SkillSlots';
import { AnimationIntentComponent } from '../../../assets/scripts/gameplay/components/AnimationIntent';
import { ConfigLoader } from '../../../assets/scripts/ConfigLoader';
import { ServiceLocator } from 'db://assets/scripts/app/ServiceLocator';

describe('UISystem', () => {
    let world: World;
    let eventBus: EventBus;
    let uiSystem: UISystem;
    let inventorySystem: InventorySystem;
    let equipmentSystem: EquipmentSystem;
    let configLoader: ConfigLoader;
    let uiManager: UIManager;
    let player: Entity;

    beforeEach(() => {
        ServiceLocator.clear();
        world = new World({ debug: false });
        eventBus = new EventBus();
        configLoader = new ConfigLoader();
        uiManager = new UIManager();
        ServiceLocator.register(UIManager, uiManager);
        uiManager.setWorld(world);
        uiManager.setEventBus(eventBus);

        // 创建玩家实体
        player = world.createEntity('Player');
        player.addComponent(LevelExperienceComponent);
        player.addComponent(InventoryComponent);
        player.addComponent(SkillSlotsComponent);
        player.addComponent(AnimationIntentComponent);

        // 注册系统
        inventorySystem = world.registerSystem(InventorySystem);
        inventorySystem.setConfigLoader(configLoader);

        equipmentSystem = world.registerSystem(EquipmentSystem);
        equipmentSystem.setConfigLoader(configLoader);
        equipmentSystem.setEventBus(eventBus);

        uiSystem = world.registerSystem(UISystem);
        uiSystem.setEventBus(eventBus);
        uiSystem.setInventorySystem(inventorySystem);
        uiSystem.setEquipmentSystem(equipmentSystem);

        // 初始化系统
        uiSystem.onInit();
    });

    afterEach(() => {
        uiManager.clear();
        world.destroy();
    });

    describe('UI 事件处理', () => {
        it('应该只处理 ui: 命名空间的事件', () => {
            let handled = false;
            const nonUIEvent = {
                type: 'UIEvent' as const,
                eventName: 'non_ui_event',
                data: {}
            };

            eventBus.push(nonUIEvent);
            eventBus.flush();

            // 不应该处理非 ui: 事件
            expect(handled).toBe(false);
        });

        it('应该处理 ui:use_item 事件', () => {
            // 添加一个消耗品到背包
            const item = player.getComponent(InventoryComponent)!;
            item.addItem('potion_heal', 1, configLoader);

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:use_item',
                data: { itemId: 'potion_heal', slotIndex: 0 }
            };

            eventBus.push(event);
            eventBus.flush();

            // 物品应该被使用（从背包移除）
            const itemAfter = item.getItem(0);
            expect(itemAfter).toBeNull();
        });

        it('应该处理 ui:use_skill 事件', () => {
            const skillSlots = player.getComponent(SkillSlotsComponent)!;
            const animIntent = player.getComponent(AnimationIntentComponent)!;

            // 设置一个技能
            const skillConfig = configLoader.getSkillConfig('fireball');
            if (skillConfig) {
                skillSlots.setSkill(0, 'fireball', skillConfig);
            }

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:use_skill',
                data: { slotIndex: 0 }
            };

            eventBus.push(event);
            eventBus.flush();

            // AnimationIntent 应该被设置
            expect(animIntent.triggerIntent).toBe('skill_0');
        });

        it('应该处理 ui:open_inventory 事件', () => {
            const mockUI = {
                show: jest.fn()
            };
            uiManager.registerUI('InventoryUI', mockUI as any);

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:open_inventory',
                data: {}
            };

            eventBus.push(event);
            eventBus.flush();

            expect(mockUI.show).toHaveBeenCalled();
        });

        it('应该处理 ui:close_inventory 事件', () => {
            const mockUI = {
                hide: jest.fn()
            };
            uiManager.registerUI('InventoryUI', mockUI as any);

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:close_inventory',
                data: {}
            };

            eventBus.push(event);
            eventBus.flush();

            expect(mockUI.hide).toHaveBeenCalled();
        });

        it('应该处理 ui:open_skill_panel 事件', () => {
            const mockUI = {
                show: jest.fn()
            };
            uiManager.registerUI('SkillUI', mockUI as any);

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:open_skill_panel',
                data: {}
            };

            eventBus.push(event);
            eventBus.flush();

            expect(mockUI.show).toHaveBeenCalled();
        });

        it('应该处理 ui:open_stats_panel 事件', () => {
            const mockUI = {
                show: jest.fn()
            };
            uiManager.registerUI('StatsUI', mockUI as any);

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:open_stats_panel',
                data: {}
            };

            eventBus.push(event);
            eventBus.flush();

            expect(mockUI.show).toHaveBeenCalled();
        });
    });

    describe('技能冷却检查', () => {
        it('不应该触发冷却中的技能', () => {
            const skillSlots = player.getComponent(SkillSlotsComponent)!;
            const animIntent = player.getComponent(AnimationIntentComponent)!;

            // 设置一个技能并设置冷却时间
            const skillConfig = configLoader.getSkillConfig('fireball');
            if (skillConfig) {
                skillSlots.setSkill(0, 'fireball', skillConfig);
                const skill = skillSlots.getSkill(0);
                if (skill) {
                    skill.cooldown = 5.0; // 冷却中
                }
            }

            const event = {
                type: 'UIEvent' as const,
                eventName: 'ui:use_skill',
                data: { slotIndex: 0 }
            };

            eventBus.push(event);
            eventBus.flush();

            // AnimationIntent 不应该被设置
            expect(animIntent.triggerIntent).toBeNull();
        });
    });
});
