/**
 * 冷却系统
 * 
 * 管理技能槽位的冷却时间
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 */

import { System, system } from '@bl-framework/ecs';
import { SkillSlotsComponent } from '../components/SkillSlots';

@system({ priority: 5 })
export class CooldownSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [SkillSlotsComponent]
        });

               query.forEach(entity => {
            const skillSlots = entity.getComponent(SkillSlotsComponent)!;

            // 更新所有技能槽位的冷却时间
            for (let i = 0; i < skillSlots.slots.length; i++) {
                const slot = skillSlots.getSkill(i);
                if (!slot) continue;

                // 如果冷却时间大于 0，减少冷却时间
                if (slot.cooldown > 0) {
                    slot.cooldown = Math.max(0, slot.cooldown - dt);
                }
            }
        });
    }
}
