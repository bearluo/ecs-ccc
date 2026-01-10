/**
 * 背包系统
 * 
 * 处理物品添加、移除和使用逻辑
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 被动系统，只处理外部调用
 * - 与 EquipmentSystem 集成（装备从背包移除）
 * - 与 LootSystem 集成（掉落物品添加到背包）
 * 
 * 设计决策：被动系统（只处理外部调用）
 * 参考文档：memory-bank/creative/creative-inventory-component.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { InventoryComponent } from '../components/Inventory';
import { HPComponent } from '../components/HP';
import { BuffListComponent } from '../components/BuffList';
import { ConfigLoader } from '../../ConfigLoader';

@system({ priority: 7 })  // 在 EquipmentSystem 之后
export class InventorySystem extends System {
    private configLoader?: ConfigLoader;

    setConfigLoader(configLoader: ConfigLoader): void {
        this.configLoader = configLoader;
    }

    /**
     * 添加物品到背包（外部调用）
     * @param entity 目标实体
     * @param itemId 物品 ID
     * @param count 数量
     * @returns 是否成功添加
     */
    addItem(entity: Entity, itemId: string, count: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory || !this.configLoader) return false;

        return inventory.addItem(itemId, count, this.configLoader);
    }

    /**
     * 从背包移除物品（外部调用）
     * @param entity 目标实体
     * @param slotIndex 槽位索引
     * @param count 数量
     * @returns 是否成功移除
     */
    removeItem(entity: Entity, slotIndex: number, count: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory) return false;

        return inventory.removeItem(slotIndex, count);
    }

    /**
     * 移除物品（通过物品 ID 和数量，外部调用）
     * @param entity 目标实体
     * @param itemId 物品 ID
     * @param count 数量
     * @returns 是否成功移除
     */
    removeItemByType(entity: Entity, itemId: string, count: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory) return false;

        return inventory.removeItemByType(itemId, count);
    }

    /**
     * 使用物品（消耗品，外部调用）
     * @param entity 目标实体
     * @param slotIndex 槽位索引
     * @returns 是否成功使用
     */
    useItem(entity: Entity, slotIndex: number): boolean {
        const inventory = entity.getComponent(InventoryComponent);
        if (!inventory) return false;

        const item = inventory.getItem(slotIndex);
        if (!item || item.config.type !== 'consumable') return false;

        const effect = item.config.consumableEffect;
        if (!effect) return false;

        // 应用消耗品效果
        switch (effect.type) {
            case 'heal':
                this.applyHealEffect(entity, effect.value);
                break;
            case 'buff':
                this.applyBuffEffect(entity, effect.value, effect.duration);
                break;
            case 'damage':
                // 伤害效果（对自身）
                this.applyDamageEffect(entity, effect.value);
                break;
        }

        // 消耗数量
        return inventory.removeItem(slotIndex, 1);
    }

    /**
     * 应用治疗效果
     */
    private applyHealEffect(entity: Entity, value: number): void {
        const hp = entity.getComponent(HPComponent);
        if (hp) {
            hp.cur = Math.min(hp.cur + value, hp.max);
        }
    }

    /**
     * 应用 Buff 效果
     */
    private applyBuffEffect(entity: Entity, value: number, duration?: number): void {
        const buffList = entity.getComponent(BuffListComponent);
        if (buffList && duration) {
            // 这里简化处理，实际应该根据 Buff 类型添加对应的 Buff
            // 例如：速度加成 Buff
            buffList.addBuff(
                `speed_boost_${Date.now()}`, // 唯一 ID
                'speed_boost',
                duration,
                1,
                { value }, // 参数：加成值
                'item' // 来源：物品
            );
        }
    }

    /**
     * 应用伤害效果（对自身）
     */
    private applyDamageEffect(entity: Entity, value: number): void {
        const hp = entity.getComponent(HPComponent);
        if (hp) {
            hp.cur = Math.max(0, hp.cur - value);
        }
    }

    onUpdate(dt: number): void {
        // 被动系统，不主动查询
        // 所有逻辑通过外部调用触发
    }
}
