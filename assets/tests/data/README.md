# 测试配置数据

本目录包含用于测试场景的配置数据，与正式配置（`assets/scripts/data/configs`）区分开。

## 目录结构

```
assets/tests/data/
├── configs/
│   ├── skills.ts              # 测试技能配置
│   ├── buffs.ts               # 测试 Buff 配置
│   ├── resource-preload.ts    # 测试资源预加载配置
│   └── index.ts              # 配置导出
└── README.md                  # 本文件
```

## 配置文件说明

### 1. 测试技能配置 (`skills.ts`)

包含测试用的技能配置：

- `test-fireball`: 测试火球术（伤害类型）
- `test-heal`: 测试治疗（治疗类型）
- `test-buff`: 测试增益（Buff 类型）
- `test-teleport`: 测试传送（传送类型）

**使用示例：**

```typescript
import { TestSkillConfigs } from 'db://assets/tests/data/configs/skills';

const fireballConfig = TestSkillConfigs['test-fireball'];
```

### 2. 测试 Buff 配置 (`buffs.ts`)

包含测试用的 Buff 配置：

- `test_speed_boost`: 测试速度提升
- `test_poison`: 测试中毒
- `test_heal_over_time`: 测试持续治疗
- `test_damage_boost`: 测试伤害提升

**使用示例：**

```typescript
import { TestBuffConfigs } from 'db://assets/tests/data/configs/buffs';

const speedBoostConfig = TestBuffConfigs['test_speed_boost'];
```

### 3. 测试资源预加载配置 (`resource-preload.ts`)

包含测试用的资源预加载配置：

- `TestStartupPreloadConfig`: 测试启动预加载配置
- `TestScenePreloadConfigs`: 测试场景预加载配置

**使用示例：**

```typescript
import { TestStartupPreloadConfig } from 'db://assets/tests/data/configs/resource-preload';

await resourcePreloader.preloadParallel(TestStartupPreloadConfig);
```

## 在测试场景中使用

在 `scene-test-game.ts` 中可以使用测试配置：

```typescript
import { TestSkillConfigs } from 'db://assets/tests/data/configs/skills';
import { TestBuffConfigs } from 'db://assets/tests/data/configs/buffs';

// 使用测试技能配置
const testFireball = TestSkillConfigs['test-fireball'];
playerSkills.setSkill(0, 'test-fireball', testFireball);

// 使用测试 Buff 配置
const testSpeedBoost = TestBuffConfigs['test_speed_boost'];
buffs.addBuff('test_speed_boost_1', 'test_speed_boost', 3.0, 1, testSpeedBoost.params);
```

## 注意事项

1. **测试配置与正式配置分离**：测试配置使用 `test-` 前缀，避免与正式配置冲突
2. **类型安全**：测试配置使用与正式配置相同的类型定义，保证类型安全
3. **独立测试**：测试配置可以独立于正式配置进行测试，不影响正式游戏逻辑

## 运行测试

运行测试配置的单元测试：

```bash
npm test -- tests/data/TestConfigs.test.ts
```
