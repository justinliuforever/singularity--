# 《流氓叙事》本体 Schema（初稿 · 从骨干层真实产出反推）

> 状态：基于骨干层数字化产出（entities.yaml / 真相还原.md / 分幕 / 线索 / NPC 演绎）反推。
> 阶段二（角色册全文）会补全"逐角色知识分区"。引擎选型见末节，待数据量稳定后定。
> 设计主线：**统一权威模型（图）为唯一真相源 → 各角色 agent 知识库是它的投影**；`02_truth` 仅裁判可见，是 agent 隔离墙。

---

## 一、节点类型（图的顶点）

### 1. Character 人物　〔已体现：entities.yaml / 03_characters / 04_npcs〕
| 字段 | 说明 |
|---|---|
| `id` / `name` | 主名（如 程聿怀） |
| `role` | PC / NPC |
| `aliases[]` | 异写 + 隐藏指代（延迟、小程、瑞法·莱诺、神偷先生…） |
| `gender_variant` | 部分角色男女双版（程聿怀、羌青瓷恋陪位随之反向匹配） |
| `persona` | 人设/语气（agent 用） |
| `profile_ref` | → 03_characters/<名>/_profile.md（上帝视角小传） |
| `cp` / `kin` | 恋陪位、亲属（结构化见关系边） |

### 2. Fact 事实　〔已体现：真相还原.md / 各线索 [reveals]〕
剧本逻辑的原子。**这是图的核心。**
| 字段 | 说明 |
|---|---|
| `id` | 稳定 ID，如 F112（命名空间见第四节） |
| `surface` | 表象（对外/场上口径，DM 须守的"谎"） |
| `truth` | 真相（上帝视角） |
| `access` | `public` / `secret` / `referee_only` |
| `reveal_act` | 在第几幕/何条件下揭示 |
| `cross_ref[]` | 关联 fact（F112↔F113↔F120…） |
| `conflict` | 已知矛盾/存疑（如 1995 vs 2000 大屠杀口径） |

### 3. Clue 线索　〔已体现：clues.csv（85 行，9 列）〕
`card_id / title / act / related_chars[] / type(明文|谜面|视觉资产|混合) / show_condition / difficulty / source_file / source_pages`，外加 `reveals→Fact[]`。

### 4. Puzzle 谜面　〔已体现：_谜面清单.csv（30 条）〕
`name / prompt / answer_or_status`，外加 `gates→Clue|Fact`（贝姬频道、船票编号、唱片错位、链式留言…）。

### 5. Act/Scene 幕　〔已体现：05_acts（12 段）〕
`order / name / tasks / atmosphere / props[] / bgm[] / clue_triggers[] / npc_triggers[] / script(逐字控场+台词)`。

### 6. NPCPerformance 演绎段　〔已体现：04_npcs/<NPC>/演绎脚本.md〕
`title / trigger / props / bgm / staging(灯光走位) / lines(逐字台词) / reveal_on_debrief`。

### 7. Event 时间线事件　〔已体现：00_index/timeline.md〕
`time(年) / description / participants→Character[] / related_facts→Fact[]`。锚点 1960/1990/1994/1995/2000/2003/2005。

### 8. Org/Collective 组织·家族　〔已体现：entities `_校验存疑`〕
莱诺家族 / 缪家 / 怒河 / 狂草帮 等集合实体，`members→Character[]`。

### 9. Prop 道具　〔已体现：07_assets/props.csv〕
`name / usage(幕·NPC) / consumable / source`（备注列自带"第X幕/某NPC 用"的关联）。

---

## 二、关系（图的边）

**剧情/结构边**
- `(Character)-[:CP|KIN|MENTOR|ENEMY|ALIAS_OF|MEMBER_OF]->(Character|Org)`
- `(Fact)-[:SURFACE_OF|CONTRADICTS|CROSS_REF]->(Fact)`
- `(Clue)-[:REVEALS]->(Fact)`　`(Puzzle)-[:GATES]->(Clue|Fact)`
- `(Act)-[:TRIGGERS]->(Clue|NPCPerformance)`　`(Event)-[:INVOLVES]->(Character)`

**知识/认知边（反泄密的核心，agent KB 的来源）**
- `(Character)-[:KNOWS]->(Fact)`　　　　　该角色真的知道
- `(Character)-[:BELIEVES_FALSELY]->(Fact)`　被误导/自欺（如 黛利拉 误信 阿奇活着 F173）
- `(Character)-[:MUST_HIDE {from, until}]->(Fact)`　保密策略（如 蒋伯驾 卧底身份 F150，第七幕前对所有人隐藏）

---

## 三、角色知识分区 `knowledge.yaml`（阶段二产出 · agent KB 种子）

每个 PC 一份，从角色册 A/B/C 全文 + 上帝视角小传交叉抽取。**不含 02_truth 里该角色不该知道的内容。**
```yaml
character: 黛利拉
persona: "解离、决绝、外冷内炽；短句带刺"
beliefs:        # KNOWS + BELIEVES_FALSELY
  - { fact: F173, statement: "阿奇还活着陪着我", actually_true: false }
secrets:        # MUST_HIDE
  - { fact: F172, hide_from: [all], reveal_if: "序幕/第七幕认罪触发" }
goals_by_act: { 第一幕: ["不出卖狂草帮信息","质问以撒"] }
perceives_by_act:   # 各幕"我手上/感知到"的线索与演绎
  第一幕: [clue:C-第一幕-以撒, npc:奥丁《硬汉的最后一分钟》]
```

**Agent KB 编译 = 投影**：runtime 时 `KB(角色, 第N幕) = persona + KNOWS闭包(截至第N幕) + reveal策略 + 已感知线索/演绎`，由统一模型自动生成，不手维护。对抗/增删/换设定 = 改统一模型→重新编译各 agent。

---

## 四、Fact-ID 命名空间（agent 已自发占用，此处固化）

| 区段 | 用途 | 来源 |
|---|---|---|
| F001–F099 | 世界观/设定 | 布雷诺相关资料 |
| F100–F299 | 全局真相层 | 真相还原.md（现用至 F201） |
| F700–F799 | 第七幕认罪事实 | 第七幕认罪现场 |
| F100x 起按文档分配 | 其余线索局部事实 | 各线索 md |

> 待办：建 `00_index/fact_registry.csv`（fact_id, 所属文档, 状态）做唯一性闸门，防跨文档撞号（线索 card_id 已出现过撞号并修复，fact 同理要防）。

---

## 五、存储建议（GraphRAG，引擎待定）

- **图层**：上面全部节点/边 → 真相载体 + 可做一致性/可解性校验。
- **向量层**：长文本切块（小传 / 幕台词 / 线索原文 / 演绎脚本）→ 角色 agent 在权限内 RAG。
- 规模（单本）：~200 facts、~20 人物、85 线索、12 幕、数百事件 —— 量不大。**起步 Postgres+pgvector 即可；若图遍历/可解性推理成为主力再上专用图库（Neo4j/Kùzu/Memgraph）。** 待阶段二数据量稳定后拍板。

---

## 六、缺口（阶段二补全）

1. 6×PC 的 `knowledge.yaml` / `goals.yaml` / `relations.yaml`（从 A/B/C 全文）。
2. `fact_registry.csv` 唯一性闸门。
3. 程聿怀/羌青瓷 男女双版本差异落库。
4. 时间线矛盾（1995 vs 2000）裁定为单一权威口径或显式双轨。
