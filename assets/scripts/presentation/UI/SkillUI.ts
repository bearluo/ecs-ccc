/**
 * 技能界面
 * 
 * 显示技能槽位和冷却时间
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component, _decorator, Node, Prefab, Label, Sprite, instantiate } from 'cc';
import { World, Entity } from '@bl-framework/ecs';
import { UIManager } from './UIManager';
import { EventBus } from '../../bridge/EventBus';
import { SkillSlotsComponent, SkillSlotData } from '../../gameplay/components/SkillSlots';
import { SkillSlotItem } from './SkillSlotItem';
import { ServiceLocator } from '../../app/ServiceLocator';

const { ccclass, property } = _decorator;

@ccclass('SkillUI')
export class SkillUI extends Component {
    @property(Node)
    skillSlotsContainer: Node | null = null;

    @property(Prefab)
    skillSlotPrefab: Prefab | null = null;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每 0.1 秒更新一次
    private skillSlots: SkillSlotItem[] = [];

    onLoad() {
        this.uiManager = ServiceLocator.require(UIManager);
        this.uiManager.registerUI('SkillUI', this);
        this.node.active = false;

        this.createSkillSlots();
    }

    update(dt: number) {
        if (!this.node.active) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private createSkillSlots() {
        if (!this.skillSlotsContainer || !this.skillSlotPrefab) return;

        // 创建 4 个技能槽位
        for (let i = 0; i < 4; i++) {
            const slotNode = instantiate(this.skillSlotPrefab);
            const skillSlotItem = slotNode.getComponent(SkillSlotItem);
            slotNode.setParent(this.skillSlotsContainer);
            skillSlotItem.setClickCallback(() => this.onSkillClick(i));
            this.skillSlots.push(skillSlotItem);
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const skillSlots = player.getComponent(SkillSlotsComponent);
        if (!skillSlots) return;

        // 更新每个技能槽位
        for (let i = 0; i < skillSlots.maxSlots; i++) {
            const skill = skillSlots.getSkill(i);
            this.updateSkillSlot(i, skill);
        }
    }

    private updateSkillSlot(slotIndex: number, skill: SkillSlotData | null) {
        const slotNode = this.skillSlots[slotIndex];
        if (!slotNode) return;

        // 更新技能显示（图标、冷却时间等）
        if (skill) {
            slotNode.cooldown = skill.cooldown;
            slotNode.maxCooldown = skill.maxCooldown;
        } else {
            // 清空槽位
            slotNode.cooldown = 0;
            slotNode.maxCooldown = 0;
        }
    }

    /**
     * 技能槽位点击
     */
    onSkillClick(slotIndex: number) {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:use_skill',
            data: { slotIndex }
        });
    }

    /**
     * 显示技能面板
     */
    show() {
        this.node.active = true;
        this.refreshFromWorld();
    }

    /**
     * 隐藏技能面板
     */
    hide() {
        this.node.active = false;
    }
}
