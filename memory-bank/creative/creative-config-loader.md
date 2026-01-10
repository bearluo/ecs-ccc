# 创意阶段：ConfigLoader 配置系统设计

## 问题描述

在肉鸽游戏中，需要管理大量配置数据（技能配置、Buff 配置、敌人配置等）。这些配置应该：
- 从文件加载（JSON/TS）
- 支持热更新（开发时）
- 类型安全（TypeScript）
- 易于访问和查询

**需求：**
1. 支持多种配置类型（技能、Buff、敌人、道具等）
2. 支持配置加载和缓存
3. 支持配置查询（通过 ID）
4. 支持配置验证
5. 与 Cocos Creator 资源系统集成

## 约束条件

- 需要与 Cocos Creator 的资源加载系统集成
- 需要支持 TypeScript 类型定义
- 需要考虑性能（配置可能很多）
- 需要支持开发时的热更新

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Configuration System Design

### 方案 1：单例 + 字典缓存

**设计思路：**
- 使用单例模式管理配置
- 使用字典缓存已加载的配置

**实现：**
```typescript
export class ConfigLoader {
    private static instance: ConfigLoader;
    
    /** 配置缓存：configType -> id -> config */
    private configCache: Map<string, Map<string, any>> = new Map();

    static getInstance(): ConfigLoader {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }

    /** 加载配置 */
    async loadConfig<T>(configType: string, configId: string): Promise<T | null> {
        // 检查缓存
        const typeCache = this.configCache.get(configType);
        if (typeCache && typeCache.has(configId)) {
            return typeCache.get(configId) as T;
        }

        // 加载配置
        const config = await this.loadFromFile<T>(configType, configId);
        if (config) {
            if (!typeCache) {
                this.configCache.set(configType, new Map());
            }
            this.configCache.get(configType)!.set(configId, config);
        }
        return config;
    }

    /** 批量加载配置 */
    async loadConfigs<T>(configType: string, configIds: string[]): Promise<Map<string, T>> {
        const results = new Map<string, T>();
        for (const id of configIds) {
            const config = await this.loadConfig<T>(configType, id);
            if (config) {
                results.set(id, config);
            }
        }
        return results;
    }

    private async loadFromFile<T>(configType: string, configId: string): Promise<T | null> {
        // TODO: 从 Cocos Creator 资源系统加载
        // 例如：resources.load(`configs/${configType}/${configId}`, JsonAsset, ...)
        return null;
    }

    /** 清除缓存 */
    clearCache(configType?: string): void {
        if (configType) {
            this.configCache.delete(configType);
        } else {
            this.configCache.clear();
        }
    }
}
```

**优点：**
- ✅ 实现简单
- ✅ 支持缓存，性能好
- ✅ 支持按需加载

**缺点：**
- ⚠️ 单例模式，测试困难
- ⚠️ 异步加载，需要 await

---

### 方案 2：静态配置 + 类型定义（推荐）

**设计思路：**
- 使用 TypeScript 文件定义配置（编译时类型检查）
- 使用静态导入，无需异步加载
- 适合 MVP 阶段

**实现：**
```typescript
// data/configs/skills.ts
export const SkillConfigs: Record<string, SkillConfig> = {
    'fireball': {
        id: 'fireball',
        name: '火球术',
        cooldown: 3.0,
        damage: 100,
        range: 500,
        cost: 10
    },
    'heal': {
        id: 'heal',
        name: '治疗',
        cooldown: 5.0,
        heal: 50,
        cost: 15
    }
};

export interface SkillConfig {
    id: string;
    name: string;
    cooldown: number;
    damage?: number;
    heal?: number;
    range?: number;
    cost: number;
}

// ConfigLoader.ts
export class ConfigLoader {
    /** 获取技能配置 */
    getSkillConfig(skillId: string): SkillConfig | null {
        return SkillConfigs[skillId] || null;
    }

    /** 获取所有技能配置 */
    getAllSkillConfigs(): SkillConfig[] {
        return Object.values(SkillConfigs);
    }

    // 类似地，可以添加其他配置类型的方法
    getBuffConfig(buffId: string): BuffConfig | null {
        return BuffConfigs[buffId] || null;
    }
}
```

**优点：**
- ✅ 类型安全（编译时检查）
- ✅ 无需异步加载，性能好
- ✅ 易于编辑和维护
- ✅ 支持 IDE 自动补全

**缺点：**
- ⚠️ 配置需要重新编译才能生效
- ⚠️ 不适合运行时动态配置

---

### 方案 3：混合方案（静态 + 动态）

**设计思路：**
- 核心配置使用静态导入（类型安全）
- 可选配置使用动态加载（JSON）

**实现：**
```typescript
export class ConfigLoader {
    // 静态配置（编译时）
    private staticSkillConfigs: Record<string, SkillConfig> = {};
    
    // 动态配置（运行时加载）
    private dynamicSkillConfigs: Map<string, SkillConfig> = new Map();

    constructor() {
        // 初始化静态配置
        this.staticSkillConfigs = SkillConfigs;
    }

    /** 获取技能配置（优先静态，其次动态） */
    getSkillConfig(skillId: string): SkillConfig | null {
        return this.staticSkillConfigs[skillId] || this.dynamicSkillConfigs.get(skillId) || null;
    }

    /** 加载动态配置 */
    async loadDynamicConfig<T>(configType: string, configId: string): Promise<T | null> {
        // 从 JSON 文件加载
        const config = await this.loadFromJson<T>(configType, configId);
        if (config) {
            // 存储到动态配置缓存
            const cache = this.getDynamicCache<T>(configType);
            cache.set(configId, config);
        }
        return config;
    }
}
```

**优点：**
- ✅ 兼顾类型安全和灵活性
- ✅ 支持静态和动态配置

**缺点：**
- ⚠️ 实现复杂
- ⚠️ 需要管理两套配置系统

---

## 方案对比

| 方案 | 类型安全 | 性能 | 灵活性 | 实现复杂度 |
|------|----------|------|--------|------------|
| 方案 1：单例+字典 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 2：静态配置 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 方案 3：混合方案 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

---

## 推荐方案

### 🏆 方案 2：静态配置 + 类型定义（适合 MVP）

**理由：**
1. **类型安全：** 编译时类型检查，减少运行时错误
2. **性能好：** 无需异步加载，直接访问
3. **易于维护：** 代码清晰，IDE 支持好
4. **适合 MVP：** 满足阶段 2 的需求

**如果未来需要动态配置：**
- 可以升级到方案 3（混合方案）
- 或者使用方案 1（单例+字典）

---

## 实施指南

### 目录结构

```
assets/scripts/
  data/
    configs/
      skills.ts          # 技能配置
      buffs.ts           # Buff 配置
      enemies.ts         # 敌人配置
      items.ts           # 道具配置
      index.ts           # 导出所有配置
  ConfigLoader.ts        # 配置加载器
```

### 配置定义示例

```typescript
// data/configs/skills.ts
export interface SkillConfig {
    id: string;
    name: string;
    cooldown: number;
    damage?: number;
    heal?: number;
    range?: number;
    cost: number;
    effects?: string[];  // Buff ID 列表
}

export const SkillConfigs: Record<string, SkillConfig> = {
    'fireball': {
        id: 'fireball',
        name: '火球术',
        cooldown: 3.0,
        damage: 100,
        range: 500,
        cost: 10
    }
};
```

### ConfigLoader 实现

```typescript
import { SkillConfigs, SkillConfig } from '../data/configs/skills';
import { BuffConfigs, BuffConfig } from '../data/configs/buffs';

export class ConfigLoader {
    /** 获取技能配置 */
    getSkillConfig(skillId: string): SkillConfig | null {
        return SkillConfigs[skillId] || null;
    }

    /** 获取 Buff 配置 */
    getBuffConfig(buffId: string): BuffConfig | null {
        return BuffConfigs[buffId] || null;
    }

    // 类似地，可以添加其他配置类型的方法
}
```

---

## 验证

实施后需要验证：
- ✅ 配置加载正常
- ✅ 类型检查正常
- ✅ 配置查询性能满足需求
- ✅ 配置结构清晰易维护

---

## 🎨🎨🎨 EXITING CREATIVE PHASE
