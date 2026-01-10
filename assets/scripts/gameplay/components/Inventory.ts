/**
 * 背包组件
 * 
 * 存储实体的物品列表
 * 
 * ⚠️ 架构约束：
 * - 纯数据组件，可序列化
 * - 不直接操作 View 层
 * - 支持物品自动堆叠
 * 
 * 设计决策：固定槽位数组（简化版），支持自动堆叠，槽位索引稳定
 * 参考文档：memory-bank/creative/creative-inventory-component.md
 */

import { Component, component } from '@bl-framework/ecs';
import { ItemConfig } from '../../data/configs/items';
import { ConfigLoader } from '../../ConfigLoader';

/**
 * 背包物品数据
 */
export interface InventoryItem {
    itemId: string;          // 物品 ID（用于查找配置）
    config: ItemConfig;      // 物品配置（从 ConfigLoader 加载）
    count: number;           // 数量（堆叠数量）
    slotIndex: number;       // 槽位索引
}

@component({ name: 'Inventory', pooled: true, poolSize: 50 })
export class InventoryComponent extends Component {
    /** 物品槽位数组（固定大小，如 30 个） */
    slots: (InventoryItem | null)[] = new Array(30).fill(null);

    /** 最大槽位数 */
    readonly maxSlots: number = 30;

    /** 当前使用的槽位数 */
    get usedSlots(): number {
        return this.slots.filter(slot => slot !== null).length;
    }

    /** 是否有空槽位 */
    get hasEmptySlot(): boolean {
        return this.usedSlots < this.maxSlots;
    }

    /**
     * 添加物品（自动堆叠）
     * @param itemId 物品 ID
     * @param count 数量
     * @param configLoader 配置加载器
     * @returns 是否全部添加成功
     */
    addItem(itemId: string, count: number, configLoader: ConfigLoader): boolean {
        const config = configLoader.getItemConfig(itemId);
        if (!config) return false;

        // 如果物品可堆叠，尝试堆叠到现有槽位
        if (config.stackable) {
            for (let i = 0; i < this.maxSlots; i++) {
                const slot = this.slots[i];
                if (slot && slot.itemId === itemId) {
                    const maxStack = config.maxStack || 99;
                    const canAdd = Math.min(count, maxStack - slot.count);
                    if (canAdd > 0) {
                        slot.count += canAdd;
                        count -= canAdd;
                        if (count <= 0) return true;
                    }
                }
            }
        }

        // 查找空槽位
        for (let i = 0; i < this.maxSlots && count > 0; i++) {
            if (this.slots[i] === null) {
                const maxStack = config.maxStack || 99;
                const addCount = Math.min(count, maxStack);
                this.slots[i] = {
                    itemId,
                    config,
                    count: addCount,
                    slotIndex: i
                };
                count -= addCount;
            }
        }

        return count === 0; // 是否全部添加成功
    }

    /**
     * 移除物品（通过槽位索引）
     * @param slotIndex 槽位索引
     * @param count 数量
     * @returns 是否成功移除
     */
    removeItem(slotIndex: number, count: number): boolean {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return false;

        const slot = this.slots[slotIndex];
        if (!slot) return false;

        if (slot.count <= count) {
            this.slots[slotIndex] = null;
        } else {
            slot.count -= count;
        }
        return true;
    }

    /**
     * 移除物品（通过物品 ID 和数量）
     * @param itemId 物品 ID
     * @param count 数量
     * @returns 是否成功移除
     */
    removeItemByType(itemId: string, count: number): boolean {
        let remaining = count;
        
        for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot && slot.itemId === itemId) {
                if (slot.count <= remaining) {
                    remaining -= slot.count;
                    this.slots[i] = null;
                } else {
                    slot.count -= remaining;
                    remaining = 0;
                }
            }
        }

        return remaining === 0;
    }

    /**
     * 获取物品（通过槽位索引）
     * @param slotIndex 槽位索引
     * @returns 物品数据，如果不存在返回 null
     */
    getItem(slotIndex: number): InventoryItem | null {
        return slotIndex >= 0 && slotIndex < this.maxSlots ? this.slots[slotIndex] : null;
    }

    /**
     * 查找物品槽位（通过物品 ID）
     * @param itemId 物品 ID
     * @returns 槽位索引数组
     */
    findItem(itemId: string): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] && this.slots[i]!.itemId === itemId) {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * 获取物品总数（通过物品 ID，考虑堆叠）
     * @param itemId 物品 ID
     * @returns 总数量
     */
    getItemCount(itemId: string): number {
        return this.findItem(itemId).reduce((sum, index) => {
            const slot = this.slots[index];
            return sum + (slot ? slot.count : 0);
        }, 0);
    }

    reset(): void {
        super.reset();
        this.slots = new Array(30).fill(null);
    }
}
