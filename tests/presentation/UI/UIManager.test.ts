/**
 * UIManager 单元测试
 */

import { UIManager } from '../../../assets/scripts/presentation/UI/UIManager';
import { World, Entity } from '@bl-framework/ecs';
import { EventBus } from '../../../assets/scripts/bridge/EventBus';
import { LevelExperienceComponent } from '../../../assets/scripts/gameplay/components/LevelExperience';
import { InventoryComponent } from '../../../assets/scripts/gameplay/components/Inventory';
import { Component } from 'cc';
import { ServiceLocator } from 'db://assets/scripts/app/ServiceLocator';

describe('UIManager', () => {
    let uiManager: UIManager;
    let world: World;
    let eventBus: EventBus;

    beforeEach(() => {
        ServiceLocator.clear();
        uiManager = new UIManager();
        ServiceLocator.register(UIManager, uiManager);
        world = new World({ debug: false });
        eventBus = new EventBus();
        uiManager.setWorld(world);
        uiManager.setEventBus(eventBus);
    });

    afterEach(() => {
        uiManager.clear();
    });

    describe('单例模式', () => {
        it('应该返回同一个实例', () => {
            const instance1 = ServiceLocator.require(UIManager);
            const instance2 = ServiceLocator.require(UIManager);
            expect(instance1).toBe(instance2);
        });
    });

    describe('World 和 EventBus 管理', () => {
        it('应该设置和获取 World', () => {
            uiManager.setWorld(world);
            expect(uiManager.getWorld()).toBe(world);
        });

        it('应该设置和获取 EventBus', () => {
            uiManager.setEventBus(eventBus);
            expect(uiManager.getEventBus()).toBe(eventBus);
        });
    });

    describe('UI 模块管理', () => {
        it('应该注册和获取 UI 模块', () => {
            const mockUI = {} as Component;
            uiManager.registerUI('TestUI', mockUI);
            expect(uiManager.getUI('TestUI')).toBe(mockUI);
        });

        it('应该返回 null 如果 UI 模块不存在', () => {
            expect(uiManager.getUI('NonExistentUI')).toBeNull();
        });
    });

    describe('getPlayerEntity', () => {
        it('应该找到有 LevelExperienceComponent 和 InventoryComponent 的实体', () => {
            const player = world.createEntity('Player');
            player.addComponent(LevelExperienceComponent);
            player.addComponent(InventoryComponent);

            const found = uiManager.getPlayerEntity(world);
            expect(found).toBe(player);
        });

        it('应该返回 null 如果没有玩家实体', () => {
            const enemy = world.createEntity('Enemy');
            enemy.addComponent(LevelExperienceComponent);
            // 没有 InventoryComponent

            const found = uiManager.getPlayerEntity(world);
            expect(found).toBeNull();
        });

        it('应该返回 null 如果 World 为空', () => {
            const emptyWorld = new World({ debug: false });
            const found = uiManager.getPlayerEntity(emptyWorld);
            expect(found).toBeNull();
        });
    });

    describe('clear', () => {
        it('应该清空所有 UI 模块和引用', () => {
            const mockUI = {} as Component;
            uiManager.registerUI('TestUI', mockUI);
            uiManager.setWorld(world);
            uiManager.setEventBus(eventBus);

            uiManager.clear();

            expect(uiManager.getUI('TestUI')).toBeNull();
            expect(uiManager.getWorld()).toBeNull();
            expect(uiManager.getEventBus()).toBeNull();
        });
    });
});
