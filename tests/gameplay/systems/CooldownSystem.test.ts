/// <reference types="jest" />
/**
 * CooldownSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { CooldownSystem } from 'db://assets/scripts/gameplay/systems/CooldownSystem';
import { SkillSlotsComponent } from 'db://assets/scripts/gameplay/components/SkillSlots';

describe('CooldownSystem', () => {
    let world: World;
    let cooldownSystem: CooldownSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        cooldownSystem = world.registerSystem(CooldownSystem);
    });

    describe('onUpdate', () => {
        it('应该减少技能冷却时间', () => {
            const entity = world.createEntity('TestEntity');
            const skillSlots = entity.addComponent(SkillSlotsComponent);
            
            // 添加一个技能
            skillSlots.setSkill(0, 'fireball', {
                cooldown: 2.0,
                damage: 50
            });
            
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 1.0; // 设置剩余冷却时间

            const dt = 0.5;
            cooldownSystem.onUpdate!(dt);

            expect(slot.cooldown).toBeCloseTo(0.5, 5);
        });

        it('冷却时间不应该低于 0', () => {
            const entity = world.createEntity('TestEntity');
            const skillSlots = entity.addComponent(SkillSlotsComponent);
            
            skillSlots.setSkill(0, 'fireball', {
                cooldown: 2.0,
                damage: 50
            });
            
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0.3; // 剩余冷却时间小于 dt

            const dt = 0.5;
            cooldownSystem.onUpdate!(dt);

            expect(slot.cooldown).toBe(0);
        });

        it('应该处理多个技能槽位', () => {
            const entity = world.createEntity('TestEntity');
            const skillSlots = entity.addComponent(SkillSlotsComponent);
            
            skillSlots.setSkill(0, 'fireball', { cooldown: 2.0, damage: 50 });
            skillSlots.setSkill(1, 'icebolt', { cooldown: 1.5, damage: 30 });
            
            const slot0 = skillSlots.getSkill(0)!;
            const slot1 = skillSlots.getSkill(1)!;
            slot0.cooldown = 1.0;
            slot1.cooldown = 0.8;

            const dt = 0.5;
            cooldownSystem.onUpdate!(dt);

            expect(slot0.cooldown).toBeCloseTo(0.5, 5);
            expect(slot1.cooldown).toBeCloseTo(0.3, 5);
        });

        it('应该跳过空槽位', () => {
            const entity = world.createEntity('TestEntity');
            const skillSlots = entity.addComponent(SkillSlotsComponent);
            
            // 只设置第一个槽位
            skillSlots.setSkill(0, 'fireball', { cooldown: 2.0, damage: 50 });
            const slot0 = skillSlots.getSkill(0)!;
            slot0.cooldown = 1.0;

            const dt = 0.5;
            cooldownSystem.onUpdate!(dt);

            // 应该正常更新第一个槽位
            expect(slot0.cooldown).toBeCloseTo(0.5, 5);
            // 其他槽位应该为 null
            expect(skillSlots.getSkill(1)).toBeNull();
        });
    });
});
