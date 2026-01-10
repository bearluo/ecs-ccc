/// <reference types="jest" />
/**
 * SkillSlots 组件单元测试
 */

import { World } from '@bl-framework/ecs';
import { SkillSlotsComponent } from 'db://assets/scripts/gameplay/components/SkillSlots';

describe('SkillSlotsComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('设置和获取技能', () => {
        it('应该能够设置技能到槽位', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100, range: 500 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            
            const skill = skillSlots.getSkill(0);
            expect(skill).toBeDefined();
            expect(skill?.skillId).toBe('fireball');
            expect(skill?.cooldown).toBe(0);
            expect(skill?.maxCooldown).toBe(3.0);
            expect(skill?.uses).toBe(0);
            expect(skill?.level).toBe(1);
        });

        it('应该能够查找技能槽位', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100 };
            
            skillSlots.setSkill(1, 'fireball', skillConfig);
            
            const slotIndex = skillSlots.findSlotBySkillId('fireball');
            expect(slotIndex).toBe(1);
        });

        it('应该能够获取所有技能', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            skillSlots.setSkill(1, 'heal', skillConfig);
            
            const allSkills = skillSlots.getAllSkills();
            expect(allSkills.length).toBe(2);
        });
    });

    describe('技能可用性检查', () => {
        it('应该正确检查技能是否可用', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            
            expect(skillSlots.isSkillReady(0)).toBe(true);
        });

        it('应该正确检查冷却中的技能', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            const skill = skillSlots.getSkill(0);
            if (skill) {
                skill.cooldown = 1.0;
            }
            
            expect(skillSlots.isSkillReady(0)).toBe(false);
        });

        it('应该正确检查使用次数限制', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100, maxUses: 2 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            const skill = skillSlots.getSkill(0);
            if (skill) {
                skill.uses = 2;
            }
            
            expect(skillSlots.isSkillReady(0)).toBe(false);
        });
    });

    describe('移除技能', () => {
        it('应该能够移除技能', () => {
            const skillSlots = world.addComponent(entity.id, SkillSlotsComponent);
            const skillConfig = { cooldown: 3.0, damage: 100 };
            
            skillSlots.setSkill(0, 'fireball', skillConfig);
            skillSlots.removeSkill(0);
            
            expect(skillSlots.getSkill(0)).toBeNull();
        });
    });
});
