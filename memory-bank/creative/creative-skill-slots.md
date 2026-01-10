# 创意阶段：SkillSlots 组件数据结构设计

## 问题描述

在肉鸽游戏中，实体需要支持多个技能槽位，每个技能槽位包含：
- 技能 ID 和配置
- 冷却时间（剩余时间）
- 使用次数限制（可选）
- 技能等级/强化等级
- 技能状态（可用/冷却中/禁用）

**需求：**
1. 支持多个技能槽位（如 4-6 个）
2. 支持技能冷却管理
3. 支持技能替换和升级
4. 支持技能使用次数限制
5. 数据可序列化（用于存档）

## 约束条件

- 组件必须是纯数据，可序列化
- 不能依赖 Creator API
- 需要高效查询和更新
- 需要与 SkillSystem 配合工作

---

## 🎨🎨🎨 ENTERING CREATIVE PHASE: Data Structure Design

### 方案 1：固定数组（固定槽位数）

**设计思路：**
- 使用固定大小的数组存储技能槽位
- 每个槽位可以是空（null）或包含技能数据

**实现：**
```typescript
@component({ name: 'SkillSlots', pooled: true, poolSize: 50 })
export class SkillSlotsComponent extends Component {
    /** 技能槽位数组（固定大小，如 4 个） */
    slots: (SkillSlotData | null)[] = [null, null, null, null];
    
    /** 最大槽位数 */
    readonly maxSlots: number = 4;

    /** 设置技能到槽位 */
    setSkill(slotIndex: number, skillId: string, skillConfig: any): void {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return;
        
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

    /** 移除技能 */
    removeSkill(slotIndex: number): void {
        if (slotIndex >= 0 && slotIndex < this.maxSlots) {
            this.slots[slotIndex] = null;
        }
    }

    /** 获取技能 */
    getSkill(slotIndex: number): SkillSlotData | null {
        return slotIndex >= 0 && slotIndex < this.maxSlots ? this.slots[slotIndex] : null;
    }

    /** 查找技能槽位（通过技能 ID） */
    findSlotBySkillId(skillId: string): number {
        return this.slots.findIndex(slot => slot && slot.skillId === skillId);
    }

    reset(): void {
        super.reset();
        this.slots = [null, null, null, null];
    }
}

interface SkillSlotData {
    skillId: string;          // 技能 ID
    config: any;               // 技能配置（从 ConfigLoader 加载）
    cooldown: number;           // 剩余冷却时间（秒）
    maxCooldown: number;        // 最大冷却时间（秒）
    uses: number;               // 已使用次数
    maxUses: number;            // 最大使用次数（-1 表示无限制）
    level: number;              // 技能等级
}
```

**优点：**
- ✅ 实现简单，代码清晰
- ✅ 固定大小，内存可预测
- ✅ 索引访问快速（O(1)）
- ✅ 可序列化

**缺点：**
- ⚠️ 槽位数固定，不够灵活
- ⚠️ 空槽位占用内存

---

### 方案 2：动态数组（可变槽位数）

**设计思路：**
- 使用动态数组存储技能槽位
- 支持动态添加/移除槽位

**实现：**
```typescript
@component({ name: 'SkillSlots', pooled: true, poolSize: 50 })
export class SkillSlotsComponent extends Component {
    /** 技能槽位数组（动态大小） */
    slots: SkillSlotData[] = [];
    
    /** 最大槽位数（可选限制） */
    maxSlots: number = 6;

    /** 添加技能到新槽位 */
    addSkill(skillId: string, skillConfig: any): number {
        if (this.slots.length >= this.maxSlots) {
            return -1; // 槽位已满
        }
        
        const slotIndex = this.slots.length;
        this.slots.push({
            skillId,
            config: skillConfig,
            cooldown: 0,
            maxCooldown: skillConfig.cooldown || 0,
            uses: 0,
            maxUses: skillConfig.maxUses || -1,
            level: 1
        });
        return slotIndex;
    }

    /** 设置技能到指定槽位 */
    setSkill(slotIndex: number, skillId: string, skillConfig: any): void {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return;
        
        // 扩展数组到所需大小
        while (this.slots.length <= slotIndex) {
            this.slots.push(null as any);
        }
        
        this.slots[slotIndex] = {
            skillId,
            config: skillConfig,
            cooldown: 0,
            maxCooldown: skillConfig.cooldown || 0,
            uses: 0,
            maxUses: skillConfig.maxUses || -1,
            level: 1
        };
    }

    /** 移除技能 */
    removeSkill(slotIndex: number): void {
        if (slotIndex >= 0 && slotIndex < this.slots.length) {
            this.slots.splice(slotIndex, 1);
        }
    }

    reset(): void {
        super.reset();
        this.slots = [];
        this.maxSlots = 6;
    }
}
```

**优点：**
- ✅ 灵活：支持动态槽位数
- ✅ 内存效率：只存储实际使用的槽位

**缺点：**
- ⚠️ 删除槽位后需要移动元素（或使用标记删除）
- ⚠️ 索引可能不连续

---

### 方案 3：Map 索引（键值对）

**设计思路：**
- 使用 Map 或对象字典存储技能槽位
- key 为槽位索引或技能 ID

**实现：**
```typescript
@component({ name: 'SkillSlots', pooled: true, poolSize: 50 })
export class SkillSlotsComponent extends Component {
    /** 技能槽位字典：slotIndex -> SkillSlotData */
    slots: Record<number, SkillSlotData> = {};
    
    /** 技能 ID 到槽位索引的映射 */
    skillIdToSlot: Record<string, number> = {};
    
    /** 最大槽位数 */
    maxSlots: number = 6;

    /** 设置技能到槽位 */
    setSkill(slotIndex: number, skillId: string, skillConfig: any): void {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return;
        
        // 移除旧技能（如果存在）
        const oldSkill = this.slots[slotIndex];
        if (oldSkill) {
            delete this.skillIdToSlot[oldSkill.skillId];
        }
        
        // 添加新技能
        this.slots[slotIndex] = {
            skillId,
            config: skillConfig,
            cooldown: 0,
            maxCooldown: skillConfig.cooldown || 0,
            uses: 0,
            maxUses: skillConfig.maxUses || -1,
            level: 1
        };
        this.skillIdToSlot[skillId] = slotIndex;
    }

    /** 获取技能 */
    getSkill(slotIndex: number): SkillSlotData | undefined {
        return this.slots[slotIndex];
    }

    /** 查找技能槽位（通过技能 ID） */
    findSlotBySkillId(skillId: string): number | undefined {
        return this.skillIdToSlot[skillId];
    }

    reset(): void {
        super.reset();
        this.slots = {};
        this.skillIdToSlot = {};
        this.maxSlots = 6;
    }
}
```

**优点：**
- ✅ 支持稀疏槽位（不连续索引）
- ✅ 查找快速（通过技能 ID）
- ✅ 可序列化

**缺点：**
- ⚠️ 需要维护两个数据结构（同步问题）
- ⚠️ 遍历需要 Object.values() 或 Object.keys()

---

### 方案 4：混合方案（数组 + 索引映射）

**设计思路：**
- 使用数组存储技能槽位（支持空槽位）
- 使用 Map 建立技能 ID 到槽位索引的映射

**实现：**
```typescript
@component({ name: 'SkillSlots', pooled: true, poolSize: 50 })
export class SkillSlotsComponent extends Component {
    /** 技能槽位数组 */
    slots: (SkillSlotData | null)[] = [];
    
    /** 技能 ID 到槽位索引的映射 */
    private skillIdToSlot: Map<string, number> = new Map();
    
    /** 最大槽位数 */
    maxSlots: number = 6;

    /** 设置技能到槽位 */
    setSkill(slotIndex: number, skillId: string, skillConfig: any): void {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return;
        
        // 扩展数组到所需大小
        while (this.slots.length <= slotIndex) {
            this.slots.push(null);
        }
        
        // 移除旧技能（如果存在）
        const oldSkill = this.slots[slotIndex];
        if (oldSkill) {
            this.skillIdToSlot.delete(oldSkill.skillId);
        }
        
        // 添加新技能
        this.slots[slotIndex] = {
            skillId,
            config: skillConfig,
            cooldown: 0,
            maxCooldown: skillConfig.cooldown || 0,
            uses: 0,
            maxUses: skillConfig.maxUses || -1,
            level: 1
        };
        this.skillIdToSlot.set(skillId, slotIndex);
    }

    /** 查找技能槽位（通过技能 ID） */
    findSlotBySkillId(skillId: string): number | undefined {
        return this.skillIdToSlot.get(skillId);
    }

    reset(): void {
        super.reset();
        this.slots = [];
        this.skillIdToSlot.clear();
        this.maxSlots = 6;
    }
}
```

**优点：**
- ✅ 数组存储，遍历高效
- ✅ Map 索引，查找快速
- ✅ 支持空槽位

**缺点：**
- ⚠️ Map 不能直接序列化（需要转换）
- ⚠️ 需要维护两个数据结构

---

## 方案对比

| 方案 | 灵活性 | 查找性能 | 序列化 | 实现复杂度 | 内存效率 |
|------|--------|----------|--------|------------|----------|
| 方案 1：固定数组 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 方案 2：动态数组 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 3：Map 索引 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 方案 4：混合方案 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 推荐方案

### 🏆 方案 1：固定数组（适合肉鸽游戏）

**理由：**
1. **简单实用：** 肉鸽游戏中技能槽位通常是固定的（如 4-6 个）
2. **性能好：** 数组索引访问 O(1)，遍历高效
3. **序列化友好：** 直接 JSON 序列化
4. **易于理解：** 代码清晰，维护简单

**适用场景：**
- 技能槽位数固定（如 4-6 个）
- 这是肉鸽游戏中最常见的场景

**如果未来需要动态槽位：**
- 可以升级到方案 2（动态数组）
- 或者使用方案 3（Map 索引）

---

## 实施指南

### 数据结构定义

```typescript
interface SkillSlotData {
    skillId: string;          // 技能 ID（对应配置文件中的技能）
    config: any;               // 技能配置（从 ConfigLoader 加载，包含伤害、范围等）
    cooldown: number;           // 剩余冷却时间（秒）
    maxCooldown: number;        // 最大冷却时间（秒，从 config 读取）
    uses: number;               // 已使用次数
    maxUses: number;            // 最大使用次数（-1 表示无限制）
    level: number;              // 技能等级（用于伤害/效果计算）
}
```

### 关键方法

1. `setSkill(slotIndex, skillId, config)` - 设置技能到槽位
2. `removeSkill(slotIndex)` - 移除技能
3. `getSkill(slotIndex)` - 获取技能
4. `findSlotBySkillId(skillId)` - 查找技能槽位
5. `isSkillReady(slotIndex)` - 检查技能是否可用（冷却完成且未达使用上限）

### 使用示例

```typescript
// 设置技能到槽位 0
skillSlots.setSkill(0, 'fireball', {
    cooldown: 3.0,
    damage: 100,
    range: 500
});

// 检查技能是否可用
const skill = skillSlots.getSkill(0);
if (skill && skill.cooldown <= 0 && (skill.maxUses < 0 || skill.uses < skill.maxUses)) {
    // 可以使用技能
}

// 使用技能后更新冷却
skill.cooldown = skill.maxCooldown;
skill.uses++;
```

---

## 验证

实施后需要验证：
- ✅ 技能设置和移除正常
- ✅ 冷却时间管理正常
- ✅ 使用次数限制正常
- ✅ 数据可序列化
- ✅ 查询性能满足需求

---

## 🎨🎨🎨 EXITING CREATIVE PHASE
