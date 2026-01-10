/**
 * 技能槽组件
 * 
 * 存储实体的技能槽位信息
 * 
 * 设计决策：使用固定数组存储技能槽位（4-6 个），支持冷却和使用次数限制
 * 参考文档：memory-bank/creative/creative-skill-slots.md
 */

import { Component, component } from '@bl-framework/ecs';

/**
 * 技能槽数据
 */
export interface SkillSlotData {
    /** 技能 ID（对应配置文件中的技能） */
    skillId: string;
    /** 技能配置（从 ConfigLoader 加载，包含伤害、范围等） */
    config: any;
    /** 剩余冷却时间（秒） */
    cooldown: number;
    /** 最大冷却时间（秒，从 config 读取） */
    maxCooldown: number;
    /** 已使用次数 */
    uses: number;
    /** 最大使用次数（-1 表示无限制） */
    maxUses: number;
    /** 技能等级（用于伤害/效果计算） */
    level: number;
}

@component({ name: 'SkillSlots', pooled: true, poolSize: 50 })
export class SkillSlotsComponent extends Component {
    /** 技能槽位数组（固定大小，如 4 个） */
    slots: (SkillSlotData | null)[] = [null, null, null, null];
    
    /** 最大槽位数 */
    readonly maxSlots: number = 4;

    /**
     * 设置技能到槽位
     * @param slotIndex 槽位索引（0-3）
     * @param skillId 技能 ID
     * @param skillConfig 技能配置
     */
    setSkill(slotIndex: number, skillId: string, skillConfig: any): void {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) {
            console.warn(`[SkillSlots] Invalid slot index: ${slotIndex}`);
            return;
        }
        
        this.slots[slotIndex] = {
            skillId,
            config: skillConfig,
            cooldown: 0,
            maxCooldown: skillConfig.cooldown || 0,
            uses: 0,
            maxUses: skillConfig.maxUses || -1, // -1 表示无限制
            level: 1
        };
    }

    /**
     * 移除技能
     * @param slotIndex 槽位索引
     */
    removeSkill(slotIndex: number): void {
        if (slotIndex >= 0 && slotIndex < this.maxSlots) {
            this.slots[slotIndex] = null;
        }
    }

    /**
     * 获取技能
     * @param slotIndex 槽位索引
     * @returns 技能数据，如果不存在返回 null
     */
    getSkill(slotIndex: number): SkillSlotData | null {
        return slotIndex >= 0 && slotIndex < this.maxSlots ? this.slots[slotIndex] : null;
    }

    /**
     * 查找技能槽位（通过技能 ID）
     * @param skillId 技能 ID
     * @returns 槽位索引，如果不存在返回 -1
     */
    findSlotBySkillId(skillId: string): number {
        for (let i = 0; i < this.maxSlots; i++) {
            const slot = this.slots[i];
            if (slot && slot.skillId === skillId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 检查技能是否可用（冷却完成且未达使用上限）
     * @param slotIndex 槽位索引
     * @returns 是否可用
     */
    isSkillReady(slotIndex: number): boolean {
        const skill = this.getSkill(slotIndex);
        if (!skill) return false;
        
        // 检查冷却
        if (skill.cooldown > 0) return false;
        
        // 检查使用次数
        if (skill.maxUses >= 0 && skill.uses >= skill.maxUses) return false;
        
        return true;
    }

    /**
     * 获取所有非空技能槽位
     * @returns 技能槽位数组
     */
    getAllSkills(): SkillSlotData[] {
        return this.slots.filter((slot): slot is SkillSlotData => slot !== null);
    }

    reset(): void {
        super.reset();
        this.slots = [null, null, null, null];
    }
}
