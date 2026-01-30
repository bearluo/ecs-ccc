/**
 * UI 事件处理系统
 * 
 * 处理来自 UI 层的事件，调用相应的 ECS 系统
 * 
 * ⚠️ 架构约束：
 * - Fixed System，处理 UI 事件
 * - 只处理 ui: 命名空间的事件
 * - 通过调用其他系统的方法来处理事件
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { EventBus } from '../../bridge/EventBus';
import { InventorySystem } from './InventorySystem';
import { EquipmentSystem } from './EquipmentSystem';
import { AnimationIntentComponent } from '../components/AnimationIntent';
import { SkillSlotsComponent } from '../components/SkillSlots';
import { InventoryComponent } from '../components/Inventory';
import { EquipmentSlotType } from '../../data/configs/equipment';
import { UIManager } from '../../presentation/UI/UIManager';

/**
 * UI 事件类型
 */
type UIEvent = {
    type: 'UIEvent';
    eventName: string;
    data?: any;
};

@system({ priority: 10 })
export class UISystem extends System {
    private eventBus?: EventBus;
    private inventorySystem?: InventorySystem;
    private equipmentSystem?: EquipmentSystem;

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    setInventorySystem(system: InventorySystem): void {
        this.inventorySystem = system;
    }

    setEquipmentSystem(system: EquipmentSystem): void {
        this.equipmentSystem = system;
    }

    onInit(): void {
        if (this.eventBus) {
            this.eventBus.subscribe('UIEvent', this.onUIEvent.bind(this));
        }
    }

    private onUIEvent(event: UIEvent): void {
        // 只处理 ui: 命名空间的事件
        if (!event.eventName.startsWith('ui:')) {
            return;
        }

        switch (event.eventName) {
            case 'ui:use_item':
                this.handleUseItem(event.data);
                break;
            case 'ui:equip_item':
                this.handleEquipItem(event.data);
                break;
            case 'ui:use_skill':
                this.handleUseSkill(event.data);
                break;
            case 'ui:open_inventory':
                this.handleOpenInventory();
                break;
            case 'ui:close_inventory':
                this.handleCloseInventory();
                break;
            case 'ui:open_skill_panel':
                this.handleOpenSkillPanel();
                break;
            case 'ui:open_stats_panel':
                this.handleOpenStatsPanel();
                break;
            default:
                console.warn(`[UISystem] Unknown UI event: ${event.eventName}`);
        }
    }

    /**
     * 处理使用物品事件
     */
    private handleUseItem(data: { itemId: string; slotIndex: number }): void {
        const player = this.findPlayerEntity();
        if (!player) return;

        // 使用物品
        this.inventorySystem?.useItem(player, data.slotIndex);
    }

    /**
     * 处理装备物品事件
     */
    private handleEquipItem(data: { itemId: string; slotIndex: number }): void {
        const player = this.findPlayerEntity();
        if (!player || !this.equipmentSystem) return;

        const inventory = player.getComponent(InventoryComponent);
        if (!inventory) return;

        const item = inventory.getItem(data.slotIndex);
        if (!item || item.config.type !== 'equipment' || !item.config.equipmentConfig) {
            return;
        }

        // 获取装备类型
        const equipmentConfig = item.config.equipmentConfig;
        const slotType = equipmentConfig.type as EquipmentSlotType;

        // 装备物品（从背包装备）
        this.equipmentSystem.equipItem(player, slotType, data.itemId, data.slotIndex);
    }

    /**
     * 处理使用技能事件
     */
    private handleUseSkill(data: { slotIndex: number }): void {
        const player = this.findPlayerEntity();
        if (!player) return;

        const skillSlots = player.getComponent(SkillSlotsComponent);
        if (!skillSlots) return;

        const skill = skillSlots.getSkill(data.slotIndex);
        if (!skill) return;

        // 检查冷却时间
        if (skill.cooldown > 0) {
            console.log(`[UISystem] Skill ${data.slotIndex} is on cooldown: ${skill.cooldown.toFixed(1)}s`);
            return;
        }

        // 检查使用次数
        if (skill.maxUses >= 0 && skill.uses >= skill.maxUses) {
            console.log(`[UISystem] Skill ${data.slotIndex} has reached max uses`);
            return;
        }

        // 通过 AnimationIntent 触发技能（SkillSystem 会监听 triggerIntent）
        const animIntent = player.getComponent(AnimationIntentComponent);
        if (animIntent) {
            animIntent.triggerIntent = `skill_${data.slotIndex}`;
        }
    }

    /**
     * 处理打开背包事件
     */
    private handleOpenInventory(): void {
        const uiManager = UIManager.getInstance();
        const inventoryUI = uiManager.getUI('InventoryUI');
        if (inventoryUI && typeof (inventoryUI as any).show === 'function') {
            (inventoryUI as any).show();
        }
    }

    /**
     * 处理关闭背包事件
     */
    private handleCloseInventory(): void {
        const uiManager = UIManager.getInstance();
        const inventoryUI = uiManager.getUI('InventoryUI');
        if (inventoryUI && typeof (inventoryUI as any).hide === 'function') {
            (inventoryUI as any).hide();
        }
    }

    /**
     * 处理打开技能面板事件
     */
    private handleOpenSkillPanel(): void {
        const uiManager = UIManager.getInstance();
        const skillUI = uiManager.getUI('SkillUI');
        if (skillUI && typeof (skillUI as any).show === 'function') {
            (skillUI as any).show();
        }
    }

    /**
     * 处理打开属性面板事件
     */
    private handleOpenStatsPanel(): void {
        const uiManager = UIManager.getInstance();
        const statsUI = uiManager.getUI('StatsUI');
        if (statsUI && typeof (statsUI as any).show === 'function') {
            (statsUI as any).show();
        }
    }

    /**
     * 查找玩家实体（使用 UIManager 的统一方法）
     */
    private findPlayerEntity(): Entity | null {
        const uiManager = UIManager.getInstance();
        const world = uiManager.getWorld();
        if (!world) return null;
        return uiManager.getPlayerEntity(world);
    }
}
