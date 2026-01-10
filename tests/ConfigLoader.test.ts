/// <reference types="jest" />
/**
 * ConfigLoader 单元测试
 */

import { ConfigLoader } from 'db://assets/scripts/ConfigLoader';

describe('ConfigLoader', () => {
    let configLoader: ConfigLoader;

    beforeEach(() => {
        configLoader = new ConfigLoader();
    });

    describe('getSkillConfig', () => {
        it('应该获取存在的技能配置', () => {
            const config = configLoader.getSkillConfig('fireball');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('fireball');
            expect(config!.name).toBe('火球术');
            expect(config!.type).toBe('damage');
        });

        it('不存在的技能配置应该返回 null', () => {
            const config = configLoader.getSkillConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllSkillConfigs', () => {
        it('应该返回所有技能配置', () => {
            const configs = configLoader.getAllSkillConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.id === 'fireball')).toBe(true);
            expect(configs.some(c => c.id === 'heal')).toBe(true);
        });

        it('返回的配置应该包含所有必需字段', () => {
            const configs = configLoader.getAllSkillConfigs();

            for (const config of configs) {
                expect(config.id).toBeDefined();
                expect(config.name).toBeDefined();
                expect(config.type).toBeDefined();
                expect(config.cooldown).toBeDefined();
            }
        });
    });

    describe('hasSkillConfig', () => {
        it('存在的技能配置应该返回 true', () => {
            expect(configLoader.hasSkillConfig('fireball')).toBe(true);
            expect(configLoader.hasSkillConfig('heal')).toBe(true);
        });

        it('不存在的技能配置应该返回 false', () => {
            expect(configLoader.hasSkillConfig('nonexistent')).toBe(false);
        });
    });

    describe('getBuffConfig', () => {
        it('应该获取存在的 Buff 配置', () => {
            const config = configLoader.getBuffConfig('speed_boost');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('speed_boost');
            expect(config!.name).toBe('速度提升');
            expect(config!.type).toBe('speed_boost');
        });

        it('不存在的 Buff 配置应该返回 null', () => {
            const config = configLoader.getBuffConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllBuffConfigs', () => {
        it('应该返回所有 Buff 配置', () => {
            const configs = configLoader.getAllBuffConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.id === 'speed_boost')).toBe(true);
            expect(configs.some(c => c.id === 'poison')).toBe(true);
        });

        it('返回的配置应该包含所有必需字段', () => {
            const configs = configLoader.getAllBuffConfigs();

            for (const config of configs) {
                expect(config.id).toBeDefined();
                expect(config.name).toBeDefined();
                expect(config.type).toBeDefined();
                expect(config.duration).toBeDefined();
            }
        });
    });

    describe('hasBuffConfig', () => {
        it('存在的 Buff 配置应该返回 true', () => {
            expect(configLoader.hasBuffConfig('speed_boost')).toBe(true);
            expect(configLoader.hasBuffConfig('poison')).toBe(true);
        });

        it('不存在的 Buff 配置应该返回 false', () => {
            expect(configLoader.hasBuffConfig('nonexistent')).toBe(false);
        });
    });

    describe('getFxConfig', () => {
        it('应该获取存在的特效配置', () => {
            const config = configLoader.getFxConfig('fireball');

            expect(config).not.toBeNull();
            expect(config!.key).toBe('fireball');
            expect(config!.prefabPath).toBe('effects/fireball');
            expect(config!.duration).toBe(2.0);
            expect(config!.poolSize).toBe(10);
            expect(config!.priority).toBe('normal');
        });

        it('应该获取 critical 优先级的特效配置', () => {
            const config = configLoader.getFxConfig('hit');

            expect(config).not.toBeNull();
            expect(config!.key).toBe('hit');
            expect(config!.priority).toBe('critical');
        });

        it('不存在的特效配置应该返回 null', () => {
            const config = configLoader.getFxConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllFxConfigs', () => {
        it('应该返回所有特效配置', () => {
            const configs = configLoader.getAllFxConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.key === 'fireball')).toBe(true);
            expect(configs.some(c => c.key === 'hit')).toBe(true);
            expect(configs.some(c => c.key === 'explosion')).toBe(true);
        });

        it('返回的配置应该包含所有必需字段', () => {
            const configs = configLoader.getAllFxConfigs();

            for (const config of configs) {
                expect(config.key).toBeDefined();
                expect(config.prefabPath).toBeDefined();
            }
        });
    });

    describe('hasFxConfig', () => {
        it('存在的特效配置应该返回 true', () => {
            expect(configLoader.hasFxConfig('fireball')).toBe(true);
            expect(configLoader.hasFxConfig('hit')).toBe(true);
        });

        it('不存在的特效配置应该返回 false', () => {
            expect(configLoader.hasFxConfig('nonexistent')).toBe(false);
        });
    });

    describe('getAudioConfig', () => {
        it('应该获取存在的 SFX 配置', () => {
            const config = configLoader.getAudioConfig('hit');

            expect(config).not.toBeNull();
            expect(config!.key).toBe('hit');
            expect(config!.clipPath).toBe('audio/hit');
            expect(config!.type).toBe('sfx');
            expect(config!.volume).toBe(0.8);
            expect(config!.priority).toBe('critical');
        });

        it('应该获取存在的 BGM 配置', () => {
            const config = configLoader.getAudioConfig('battle_bgm');

            expect(config).not.toBeNull();
            expect(config!.key).toBe('battle_bgm');
            expect(config!.clipPath).toBe('audio/battle_bgm');
            expect(config!.type).toBe('bgm');
            expect(config!.volume).toBe(0.5);
            expect(config!.loop).toBe(true);
            expect(config!.priority).toBe('critical');
        });

        it('不存在的音频配置应该返回 null', () => {
            const config = configLoader.getAudioConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllAudioConfigs', () => {
        it('应该返回所有音频配置', () => {
            const configs = configLoader.getAllAudioConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.key === 'skill_fireball')).toBe(true);
            expect(configs.some(c => c.key === 'hit')).toBe(true);
            expect(configs.some(c => c.key === 'battle_bgm')).toBe(true);
        });

        it('返回的配置应该包含所有必需字段', () => {
            const configs = configLoader.getAllAudioConfigs();

            for (const config of configs) {
                expect(config.key).toBeDefined();
                expect(config.clipPath).toBeDefined();
                expect(config.type).toBeDefined();
            }
        });
    });

    describe('hasAudioConfig', () => {
        it('存在的音频配置应该返回 true', () => {
            expect(configLoader.hasAudioConfig('hit')).toBe(true);
            expect(configLoader.hasAudioConfig('battle_bgm')).toBe(true);
        });

        it('不存在的音频配置应该返回 false', () => {
            expect(configLoader.hasAudioConfig('nonexistent')).toBe(false);
        });
    });

    describe('getEquipmentConfig', () => {
        it('应该获取存在的装备配置', () => {
            const config = configLoader.getEquipmentConfig('sword_iron');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('sword_iron');
            expect(config!.name).toBe('铁剑');
            expect(config!.type).toBe('weapon');
            expect(config!.statsBonus.attack).toBe(10);
        });

        it('不存在的装备配置应该返回 null', () => {
            const config = configLoader.getEquipmentConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllEquipmentConfigs', () => {
        it('应该返回所有装备配置', () => {
            const configs = configLoader.getAllEquipmentConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.id === 'sword_iron')).toBe(true);
            expect(configs.some(c => c.id === 'armor_leather')).toBe(true);
        });
    });

    describe('hasEquipmentConfig', () => {
        it('存在的装备配置应该返回 true', () => {
            expect(configLoader.hasEquipmentConfig('sword_iron')).toBe(true);
            expect(configLoader.hasEquipmentConfig('armor_leather')).toBe(true);
        });

        it('不存在的装备配置应该返回 false', () => {
            expect(configLoader.hasEquipmentConfig('nonexistent')).toBe(false);
        });
    });

    describe('getItemConfig', () => {
        it('应该获取存在的物品配置', () => {
            const config = configLoader.getItemConfig('potion_heal');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('potion_heal');
            expect(config!.name).toBe('治疗药水');
            expect(config!.type).toBe('consumable');
            expect(config!.stackable).toBe(true);
            expect(config!.maxStack).toBe(10);
        });

        it('应该为装备类型物品动态加载装备配置', () => {
            const config = configLoader.getItemConfig('sword_iron');

            expect(config).not.toBeNull();
            expect(config!.type).toBe('equipment');
            // equipmentConfig 应该被动态加载
            expect(config!.equipmentConfig).toBeDefined();
            expect(config!.equipmentConfig?.id).toBe('sword_iron');
        });

        it('不存在的物品配置应该返回 null', () => {
            const config = configLoader.getItemConfig('nonexistent');

            expect(config).toBeNull();
        });
    });

    describe('getAllItemConfigs', () => {
        it('应该返回所有物品配置', () => {
            const configs = configLoader.getAllItemConfigs();

            expect(configs.length).toBeGreaterThan(0);
            expect(configs.some(c => c.id === 'potion_heal')).toBe(true);
            expect(configs.some(c => c.id === 'scroll_speed')).toBe(true);
        });
    });

    describe('hasItemConfig', () => {
        it('存在的物品配置应该返回 true', () => {
            expect(configLoader.hasItemConfig('potion_heal')).toBe(true);
            expect(configLoader.hasItemConfig('sword_iron')).toBe(true);
        });

        it('不存在的物品配置应该返回 false', () => {
            expect(configLoader.hasItemConfig('nonexistent')).toBe(false);
        });
    });

    describe('getLootTable', () => {
        it('应该获取存在的掉落表配置', () => {
            const lootTable = configLoader.getLootTable('enemy_basic');

            expect(lootTable).not.toBeNull();
            expect(lootTable!.id).toBe('enemy_basic');
            expect(lootTable!.name).toBe('基础敌人掉落表');
            expect(lootTable!.items.length).toBeGreaterThan(0);
        });

        it('不存在的掉落表配置应该返回 null', () => {
            const lootTable = configLoader.getLootTable('nonexistent');

            expect(lootTable).toBeNull();
        });
    });

    describe('getAllLootTables', () => {
        it('应该返回所有掉落表配置', () => {
            const lootTables = configLoader.getAllLootTables();

            expect(lootTables.length).toBeGreaterThan(0);
            expect(lootTables.some(t => t.id === 'enemy_basic')).toBe(true);
            expect(lootTables.some(t => t.id === 'enemy_elite')).toBe(true);
            expect(lootTables.some(t => t.id === 'boss')).toBe(true);
        });
    });

    describe('hasLootTable', () => {
        it('存在的掉落表配置应该返回 true', () => {
            expect(configLoader.hasLootTable('enemy_basic')).toBe(true);
            expect(configLoader.hasLootTable('boss')).toBe(true);
        });

        it('不存在的掉落表配置应该返回 false', () => {
            expect(configLoader.hasLootTable('nonexistent')).toBe(false);
        });
    });
});
