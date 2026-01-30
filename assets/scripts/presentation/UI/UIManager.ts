/**
 * UI 管理器
 * 
 * 统一管理所有 UI 模块，提供 World 和 EventBus 访问
 * 提供统一的玩家实体查找方法
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component } from 'cc';
import { World, Entity } from '@bl-framework/ecs';
import { EventBus } from '../../bridge/EventBus';
import { LevelExperienceComponent } from '../../gameplay/components/LevelExperience';
import { InventoryComponent } from '../../gameplay/components/Inventory';

/**
 * UI 管理器（单例模式）
 */
export class UIManager {
    private uiModules: Map<string, Component> = new Map();
    private world: World | null = null;
    private eventBus: EventBus | null = null;

    /**
     * 注册 UI 模块
     */
    registerUI(name: string, uiComponent: Component): void {
        this.uiModules.set(name, uiComponent);
    }

    /**
     * 获取 UI 模块
     */
    getUI(name: string): Component | null {
        return this.uiModules.get(name) || null;
    }

    /**
     * 显示 UI 模块
     */
    showUI(name: string): void {
        const ui = this.uiModules.get(name);
        if (ui && ui.node) {
            ui.node.active = true;
            // 如果 UI 有 show 方法，调用它
            if (typeof (ui as any).show === 'function') {
                (ui as any).show();
            }
        }
    }

    /**
     * 隐藏 UI 模块
     */
    hideUI(name: string): void {
        const ui = this.uiModules.get(name);
        if (ui && ui.node) {
            ui.node.active = false;
            // 如果 UI 有 hide 方法，调用它
            if (typeof (ui as any).hide === 'function') {
                (ui as any).hide();
            }
        }
    }

    /**
     * 设置 World（供 UI 查询）
     */
    setWorld(world: World): void {
        this.world = world;
    }

    /**
     * 设置 EventBus（供 UI 发送事件）
     */
    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    /**
     * 获取 World（供 UI 查询）
     */
    getWorld(): World | null {
        return this.world;
    }

    /**
     * 获取 EventBus（供 UI 发送事件）
     */
    getEventBus(): EventBus | null {
        return this.eventBus;
    }

    /**
     * 查找玩家实体（统一"谁是玩家"的规则）
     * 统一规则：有 LevelExperienceComponent 和 InventoryComponent 的实体是玩家
     * 
     * @param world ECS World 实例
     * @returns 玩家实体，如果不存在返回 null
     */
    getPlayerEntity(world: World): Entity | null {
        const query = world.createQuery({
            all: [LevelExperienceComponent, InventoryComponent]
        });
        const entities = query.getEntities();
        return entities.length > 0 ? entities[0] : null;
    }

    /**
     * 清空所有 UI 模块
     */
    clear(): void {
        this.uiModules.clear();
        this.world = null;
        this.eventBus = null;
    }
}
