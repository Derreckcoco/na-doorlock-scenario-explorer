/** 旅程生成共享数据与工具 */
import { HOUSEHOLD_EVENTS } from './dimensions.js';

export { HOUSEHOLD_EVENTS };

export const PERSON_PROFILES = {
  户主: {
    role: '家庭安防与权限的主决策者',
    goals: ['快速无感进出', '确认家门安全', '管理家人与访客权限'],
    traits: ['有 App 管理习惯', '关注锁门确认', '可能双手拎物'],
    credential: '指纹 / 手机 BLE / 密码',
  },
  配偶: {
    role: '共同居住者，进出节奏可能与户主不同',
    goals: ['安静进出不打扰家人', '与配偶同步家中状态', '便捷进门'],
    traits: ['下班时间可能不同', '先到家需切换居家模式', '可能深夜归来'],
    credential: '指纹 / 手机 / 密码',
  },
  子女: {
    role: '学龄儿童或青少年，可能独自到家',
    goals: ['顺利开门', '不让陌生人进', '父母知道自己到家'],
    traits: ['身高/手指限制', '可能忘密码', '会带同学回家', '青少年晚归'],
    credential: '密码 / 指纹（识别率可能较低）',
  },
  老人: {
    role: '需简化操作的常住者，子女可能远程关注',
    goals: ['最简单方式开门', '不记复杂密码', '日常活动被子女知晓'],
    traits: ['听力/视力/记忆力下降', '操作步骤耐受度低', '护工定期到访'],
    credential: '指纹 / 简易密码 / 物理备用',
  },
  亲友: {
    role: '受邀访客，户主可能不在家',
    goals: ['按约进入', '不长时间门外等待', '离开后不残留权限'],
    traits: ['不熟悉门锁操作', '到达时间可能提前', '可能借住数日'],
    credential: '临时码 / 户主远程开门',
  },
  邻居: {
    role: '紧急或互助场景下的可信邻居',
    goals: ['紧急时快速进入', '最小权限', '事后可撤销'],
    traits: ['低频访问', '多为应急', '需远程授权'],
    credential: '一次性远程授权',
  },
  清洁: {
    role: '周期性上门保洁人员',
    goals: ['仅在预约时段进入', '离开时锁门', '户主无需在场'],
    traits: ['每周固定时间', '可能早到', '独自在屋内工作'],
    credential: '时段码 / 周期性权限',
  },
  保姆: {
    role: '日间育儿或家务人员',
    goals: ['工作日可靠进出', '送孩子进门后离开', '非工作时间权限失效'],
    traits: ['每日到达', '可能与孩子同时出入', '离职需即时撤销'],
    credential: '工作日时段码',
  },
  遛狗: {
    role: '宠物遛养服务人员',
    goals: ['短时进入取狗', '出门遛狗后归还', '自动锁门'],
    traits: ['每日 1-2 次', '每次 15-30 分钟', '狗可能冲门'],
    credential: '精确时段码',
  },
  维修人员: {
    role: '预约上门的维修/安装人员',
    goals: ['按预约时间进入', '完成后权限失效', '户主可能不在'],
    traits: ['单次或短期', '可能超时', '需身份确认'],
    credential: '预约时段码',
  },
  物业: {
    role: '公寓物业管理人员',
    goals: ['紧急或巡检时合法进入', '留痕通知租客', '合规操作'],
    traits: ['提前通知', '租客可能不在', '多户管理'],
    credential: '物业主码 / 紧急授权',
  },
  外卖: {
    role: '餐饮配送员',
    goals: ['快速完成交付', '按指示放门口或交接', '不长时间停留'],
    traits: ['30 分钟内到达', '公寓需双层门禁', '无接触交付'],
    credential: '按铃 / 无门锁权限',
  },
  快递: {
    role: '包裹配送员',
    goals: ['安全投递', '必要时短暂入室', '户主收到通知'],
    traits: ['户主常不在家', 'Porch Piracy 风险', '大件需入内'],
    credential: '时段码（Amazon Key 类）/ 放门口',
  },
  物流: {
    role: '大件/搬家物流人员',
    goals: ['进入卸货', '可能需车库/后门', '完成后离开'],
    traits: ['预约半天', '多人协作', '门长时间敞开'],
    credential: '当日临时码',
  },
};

export const RESIDENTIAL_CTX = {
  /** layoutNote 仅供内部引用（如 detail 字段），禁止直接作为用户可见的「摩擦」文案 */
  独栋: { entry: '前门车道', detail: '可能有车库门、后门、侧院门', layoutNote: '多入口' },
  联排: { entry: '临街前门', detail: '距人行道仅数步', layoutNote: '临街暴露' },
  公寓: { entry: '大堂门禁后的单元门', detail: '需先过 lobby 再上楼', layoutNote: '双层门禁' },
  豪宅: { entry: '车道门与主入口两道', detail: '员工、宾客、供应商分入口', layoutNote: '多道入口' },
  ADU: { entry: '后院独立小门', detail: '与主屋相邻但入口分离', layoutNote: '独立侧门' },
  度假屋: { entry: '偏远地区独立入口', detail: '长期无人、季节性强', layoutNote: '偏远独处' },
  '55+': { entry: '社区大门后的单元门', detail: '社区可能有统一门禁', layoutNote: '社区+单元双门禁' },
  Condo: { entry: 'HOA 大堂 + 单元门', detail: '外观与噪音受 HOA 约束', layoutNote: 'HOA管控' },
};

export const HOUSING_CTX = {
  自住: { stake: '自己承担安防后果', note: '按家庭习惯管理权限', friction: '家人之间对「谁锁门」常有分歧' },
  租赁: { stake: '租客日常使用，房东保留管理权', note: '退租必须彻底清权限', friction: '租客能否换锁、房东如何远程管理' },
  Airbnb: { stake: '房东远程运营，差评成本高', note: '入住/退房/清洁三段窗口', friction: '客人早到、迟退、密码失效直接引发投诉' },
  空置: { stake: '任何开门都可能是入侵', note: '售房/装修/交接期高敏', friction: '误报太多会麻木，漏报一次代价极大' },
  商用: { stake: '客户体验与安防并重', note: '员工排班与客户预约交织', friction: '营业中开门打断服务，下班后权限残留' },
};

export const EVENT_CTX = {
  通勤: { scene: '下班高峰驾车/地铁回家', hands: '公文包、午餐盒、笔记本电脑', rush: true, pain: '赶时间时最容易忘确认锁门' },
  上学: { scene: '放学固定时段归来', hands: '书包、乐器盒、运动包', rush: true, pain: '孩子独自操作锁是核心风险点' },
  约会: { scene: '晚间社交后回家', hands: '可能拎礼物或外套', rush: false, pain: '晚归需安静进门不吵醒家人' },
  娱乐: { scene: '看电影/运动归来', hands: '疲惫、可能拎零食', rush: false, pain: '深夜进门仍要确认安防状态' },
  办事: { scene: '银行/DMV/诊所外出归来', hands: '文件袋、处方单', rush: false, pain: '短时外出容易低估锁门必要性' },
  旅游: {
    scene: '度假结束拖着行李箱回家', hands: '行李箱、登机牌、纪念品', rush: false,
    pain: '长途旅行后首要确认家中是否被侵入',
    prep: '打包行李证件、检查水阀/电器插头/恒温器、安排宠物寄养或代浇花、请邻居代收邮件包裹',
  },
  出差: {
    scene: '商务差旅后深夜或清晨到家', hands: '行李箱、西装袋', rush: true,
    pain: '离家期间家中异常开门无法第一时间知晓',
    prep: '工作材料与行李优先，家里安防和照看安排常拖到出门前最后几分钟',
  },
  见朋友: { scene: '朋友聚会后回家', hands: '伴手礼、外套', rush: false, pain: '家中可能仍有客人或需留门给晚归家人' },
  遛狗: { scene: '每日早晚牵狗短时出入', hands: '牵引绳、拾便袋，双手占用', rush: false, pain: '20 秒外出被自动锁门外是高频事故' },
  育儿: { scene: '接送孩子、课后班衔接', hands: '抱娃、推车、书包', rush: true, pain: '一手抱娃一手开门几乎不可能' },
  倒垃圾: { scene: '仅出门 2-5 分钟倒垃圾', hands: '垃圾袋，常不带手机', rush: false, pain: '「就一分钟」心理导致不锁门或忘带凭证' },
  取包裹: { scene: '收到快递到达通知后开门', hands: '可能搬大件纸箱', rush: false, pain: '门口滞留包裹被盗（Porch Piracy）' },
  接人: { scene: '到门口接家人或客人', hands: '可能先出门等候', rush: false, pain: '人在门外等候时门未锁好形成空窗' },
  日常: { scene: '无特定日程的居家出入', hands: '日常状态', rush: false, pain: '无明确触发点，最容易形成习惯盲区' },
  派对: { scene: '家中聚会，客人陆续到达', hands: '布置物料、迎宾', rush: false, pain: '陌生人混入、散场后后门未锁、临时权限未清' },
  节日: { scene: '感恩节/圣诞节亲友到访高峰', hands: '食物、装饰品', rush: false, pain: '客人流动大、儿童门口玩耍、权限管理混乱' },
  装修: { scene: '施工队多日进出', hands: '工具、建材', rush: false, pain: '工人变动、门长期敞开、安防降级、权限难回收' },
  搬家: { scene: '搬家工人与家庭成员同时进出', hands: '纸箱、家具', rush: true, pain: '门长时间敞开、人员混杂、搬完安防未恢复' },
};

export const PHASE_META = {
  回家前: { label: '回家前', icon: '🚗', desc: '从外部接近住宅门前' },
  开门: { label: '开门', icon: '🚪', desc: '触发解锁并通过门廊' },
  门内: { label: '门内', icon: '🏠', desc: '进入室内后的安置与衔接' },
  出门前: { label: '出门前', icon: '👟', desc: '离开前的准备与检查' },
  离家: { label: '离家', icon: '🔒', desc: '关门、锁闭、确认离开' },
  长期离家: { label: '长期离家', icon: '✈️', desc: '度假/出差模式设防' },
  居家: { label: '居家', icon: '🛋️', desc: '在家中活动时的门前事件' },
  夜间: { label: '夜间', icon: '🌙', desc: '夜间低噪进出' },
};

export function mk(action, touchpoint, thought, friction) {
  return { action, touchpoint, thought, friction };
}

export function buildCtx(scenario) {
  const res = RESIDENTIAL_CTX[scenario.residential] || RESIDENTIAL_CTX['独栋'];
  const house = HOUSING_CTX[scenario.housingUsage] || HOUSING_CTX['自住'];
  const evt = EVENT_CTX[scenario.event] || EVENT_CTX['日常'];
  const isHousehold = HOUSEHOLD_EVENTS.includes(scenario.event);
  const profile = PERSON_PROFILES[scenario.person.name] || {
    role: `${scenario.person.group}角色`,
    goals: ['顺利完成门前动作'],
    traits: [],
    credential: '视权限而定',
  };
  return { res, house, evt, isHousehold, profile };
}

export function personArchetype(name) {
  if (['户主', '配偶', '子女', '老人'].includes(name)) return 'resident';
  if (['亲友', '邻居'].includes(name)) return 'visitor';
  if (['清洁', '保姆', '遛狗', '维修人员', '物业'].includes(name)) return 'service';
  return 'logistics';
}

export function eventSceneForPhase(event, phase) {
  const evt = EVENT_CTX[event] || EVENT_CTX['日常'];
  const departPhases = ['出门前', '离家', '长期离家'];
  const arrivePhases = ['回家前', '开门', '门内', '夜间', '居家'];

  const departScenes = {
    通勤: '早晨整装出门上班',
    上学: '上学前检查书包与午餐',
    旅游: '出发前收拾行李、检查家中设施',
    出差: '出差前整理行李与工作材料',
    约会: '出门前整理仪容准备赴约',
    娱乐: '出门前确认随身物品',
    办事: '出门前确认证件与预约时间',
    见朋友: '出门前确认礼物与路线',
    育儿: '出门前整理孩子物品与推车',
    倒垃圾: '仅出门 2-5 分钟倒垃圾',
    遛狗: '牵狗出门前检查牵引绳',
    接人: '出门前整理门口迎接客人',
    日常: '日常出门前检查随身物',
    派对: '派对开始前布置与迎宾准备',
    节日: '节日聚会开始前准备食物与装饰',
    装修: '施工开始前收好贵重物品',
    搬家: '搬家出发前打包与标注',
    取包裹: '收到快递通知后准备应门',
  };

  const arriveScenes = {
    通勤: evt.scene,
    上学: evt.scene,
    旅游: evt.scene,
    出差: evt.scene,
    约会: evt.scene,
    娱乐: evt.scene,
    办事: evt.scene,
    见朋友: evt.scene,
    育儿: evt.scene,
    倒垃圾: '倒完垃圾折返门前',
    遛狗: '遛完狗回到门前',
    接人: '接人结束后回到家中',
    日常: '日常归家途中',
    派对: '客人陆续到达门前',
    节日: '亲友节日期间到访',
    装修: '施工队按约到达',
    搬家: '搬家车队抵达',
    取包裹: evt.scene,
  };

  if (departPhases.includes(phase)) return departScenes[event] || evt.scene;
  if (arrivePhases.includes(phase)) return arriveScenes[event] || evt.scene;
  return evt.scene;
}

export function eventCategory(event) {
  if (['倒垃圾', '遛狗'].includes(event)) return 'quick_roundtrip';
  if (['通勤', '上学'].includes(event)) return 'daily_commute';
  if (['约会', '娱乐', '见朋友'].includes(event)) return 'social';
  if (['旅游', '出差'].includes(event)) return 'extended_absence';
  if (HOUSEHOLD_EVENTS.includes(event)) return 'household';
  if (event === '取包裹') return 'delivery';
  if (event === '育儿') return 'childcare';
  if (event === '接人') return 'pickup';
  if (event === '办事') return 'errand';
  return 'routine';
}
