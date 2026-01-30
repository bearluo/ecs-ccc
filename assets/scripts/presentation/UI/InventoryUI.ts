/**
 * 背包界面
 * 
 * 显示背包物品列表，支持物品使用和装备
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component, _decorator, Node, Prefab, Label, Sprite, instantiate } from 'cc';
import { World, Entity } from '@bl-framework/ecs';
import { UIManager } from './UIManager';
import { EventBus } from '../../bridge/EventBus';
import { InventoryComponent, InventoryItem } from '../../gameplay/components/Inventory';
import { InventorySlotItem } from './InventorySlotItem';
import { ServiceLocator } from '../../app/ServiceLocator';

const { ccclass, property } = _decorator;

@ccclass('InventoryUI')
export class InventoryUI extends Component {
    @property(Node)
    itemListContainer: Node | null = null;

    @property(Prefab)
    itemSlotPrefab: Prefab | null = null;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.2; // 每 0.2 秒更新一次
    private itemSlots: InventorySlotItem[] = [];

    onLoad() {
        this.uiManager = ServiceLocator.require(UIManager);
        this.uiManager.registerUI('InventoryUI', this);
        this.node.active = false; // 默认隐藏

        // 创建物品槽位
        this.createItemSlots();
    }

    update(dt: number) {
        if (!this.node.active) return; // 隐藏时不更新

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private createItemSlots() {
        if (!this.itemListContainer || !this.itemSlotPrefab) return;

        // 创建 30 个物品槽位
        for (let i = 0; i < 30; i++) {
            const slotNode = instantiate(this.itemSlotPrefab);
            const item = slotNode.getComponent(InventorySlotItem)
            slotNode.setParent(this.itemListContainer);
            item.setClickCallback(() => this.onItemClick(i));
            this.itemSlots.push(item);
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const inventory = player.getComponent(InventoryComponent);
        if (!inventory) return;

        // 更新每个槽位
        for (let i = 0; i < inventory.maxSlots; i++) {
            const item = inventory.getItem(i);
            this.updateItemSlot(i, item);
        }
    }

    private updateItemSlot(slotIndex: number, item: InventoryItem | null) {
        const slotNode = this.itemSlots[slotIndex];
        if (!slotNode) return;
        // 更新槽位显示（图标、数量等）

        if (item) {
            slotNode.itemId = item.itemId;
            slotNode.count = item.count;
            slotNode.icon = item.config.icon;
            slotNode.slotIndex = item.slotIndex;
        } else {
            // 清空槽位
            slotNode.itemId = '';
            slotNode.count = 0;
            slotNode.icon = '';
            slotNode.slotIndex = 0;
        }
    }

    /**
     * 物品槽位点击
     */
    onItemClick(slotIndex: number) {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const inventory = player.getComponent(InventoryComponent);
        if (!inventory) return;

        const item = inventory.getItem(slotIndex);
        if (!item) return;

        const eventBus = this.uiManager?.getEventBus();
        if (!eventBus) return;

        // 根据物品类型发送不同事件
        if (item.config.type === 'consumable') {
            // 使用物品
            eventBus.push({
                type: 'UIEvent',
                eventName: 'ui:use_item',
                data: { itemId: item.itemId, slotIndex }
            });
        } else if (item.config.type === 'equipment') {
            // 装备物品
            eventBus.push({
                type: 'UIEvent',
                eventName: 'ui:equip_item',
                data: { itemId: item.itemId, slotIndex }
            });
        }
    }

    /**
     * 关闭背包按钮点击
     */
    onCloseClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:close_inventory',
            data: {}
        });
        this.node.active = false;
    }

    /**
     * 显示背包
     */
    show() {
        this.node.active = true;
        this.refreshFromWorld(); // 显示时立即刷新
    }

    /**
     * 隐藏背包
     */
    hide() {
        this.node.active = false;
    }
}
