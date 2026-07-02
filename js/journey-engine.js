/**
 * 详细用户旅程引擎
 * 按时间节点 × 人物特征生成多阶段旅程
 */

const PERSON_PROFILES = {
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

const RESIDENTIAL_CTX = {
  独栋: { entry: '前门为主，可能有车库门、后门、庭院门', risk: '多入口状态难同步' },
  联排: { entry: '前门临街，距人行道近', risk: '开门暴露时间短、易尾随' },
  公寓: { entry: '大堂门禁 + 单元门双层', risk: '快递上楼困难、邻居尾随' },
  豪宅: { entry: '车道门 + 主门多道门禁', risk: '员工/宾客权限需分级' },
  ADU: { entry: '独立入口，与主屋相邻', risk: '租户与房主权限需隔离' },
  度假屋: { entry: '低频使用，可能偏远', risk: '长期无人、异常开门需告警' },
  '55+': { entry: '社区可能有门禁', risk: '操作需极简化' },
  Condo: { entry: 'HOA 规范，大堂+单元门', risk: '外观/噪音合规、租客流动' },
};

const HOUSING_CTX = {
  自住: { owner: '户主自主管理', mode: '日常居家模式' },
  租赁: { owner: '租客使用，房东保留管理权', mode: '退租需撤销权限' },
  Airbnb: { owner: '房东远程管理', mode: '入住/退房自动换码' },
  空置: { owner: '房东远程监控', mode: '高敏告警，任何开门异常' },
  商用: { owner: '店主/员工', mode: '客户预约 + 员工排班' },
};

const EVENT_CTX = {
  通勤: { trigger: '上下班高峰', hands: '可能拎公文包/午餐盒', rush: true },
  上学: { trigger: '学区时间固定', hands: '书包、乐器盒', rush: true },
  约会: { trigger: '晚间或周末', hands: '可能拎礼物', rush: false },
  娱乐: { trigger: '周末或晚间归来', hands: '可能疲惫', rush: false },
  办事: { trigger: '银行/DMV 等外出', hands: '携带文件袋', rush: false },
  旅游: { trigger: '度假归来或出发前', hands: '行李箱、大包', rush: false },
  出差: { trigger: '长途归来/出发', hands: '行李箱', rush: true },
  见朋友: { trigger: '社交拜访', hands: '可能拎伴手礼', rush: false },
  遛狗: { trigger: '每日 2-3 次短时', hands: '牵绳、拾便袋', rush: false },
  育儿: { trigger: '接送孩子、课后活动', hands: '抱娃、推车', rush: true },
  倒垃圾: { trigger: '短时外出 2-5 分钟', hands: '垃圾袋', rush: false },
  取包裹: { trigger: '快递到达后', hands: '可能搬大件', rush: false },
  接人: { trigger: '接送家人/客人', hands: '可能先出门等候', rush: false },
  日常: { trigger: '无特定日程', hands: '日常状态', rush: false },
};

const PHASE_META = {
  回家前: { label: '回家前', icon: '🚗', desc: '从外部接近住宅门前' },
  开门: { label: '开门', icon: '🚪', desc: '触发解锁并通过门廊' },
  门内: { label: '门内', icon: '🏠', desc: '进入室内后的安置与衔接' },
  出门前: { label: '出门前', icon: '👟', desc: '离开前的准备与检查' },
  离家: { label: '离家', icon: '🔒', desc: '关门、锁闭、确认离开' },
  长期离家: { label: '长期离家', icon: '✈️', desc: '度假/出差模式设防' },
  居家: { label: '居家', icon: '🛋️', desc: '在家中活动时的门前事件' },
  夜间: { label: '夜间', icon: '🌙', desc: '夜间低噪进出' },
};

function getJourneyPhases(moment) {
  const arcs = {
    回家前: ['回家前', '开门', '门内'],
    开门: ['回家前', '开门', '门内'],
    门内: ['开门', '门内', '出门前'],
    出门前: ['门内', '出门前', '离家'],
    离家: ['出门前', '离家'],
    长期离家: ['出门前', '离家', '长期离家'],
    居家: ['门内', '居家', '出门前'],
    夜间: ['居家', '夜间', '开门'],
  };
  return arcs[moment] || ['回家前', '开门', '门内', '出门前'];
}

function buildPhaseSteps(phase, scenario) {
  const { person, housingUsage, residential, event, activity } = scenario;
  const profile = PERSON_PROFILES[person.name] || {
    role: `${person.group}角色`,
    goals: ['顺利完成门前动作'],
    traits: [],
    credential: '视权限而定',
  };
  const res = RESIDENTIAL_CTX[residential] || RESIDENTIAL_CTX['独栋'];
  const house = HOUSING_CTX[housingUsage] || HOUSING_CTX['自住'];
  const evt = EVENT_CTX[event] || EVENT_CTX['日常'];
  const g = person.group;
  const steps = [];

  if (phase === '回家前') {
    if (g === '常住人') {
      steps.push({
        action: evt.rush
          ? `因「${event}」赶时间返回，驾车/步行接近${residential}`
          : `结束「${event}」，从外部接近${residential}`,
        touchpoint: '手机地理围栏 / 车辆',
        thought: evt.hands ? `双手占用（${evt.hands}），希望免提进门` : '门口安全吗？',
        friction: res.risk,
      });
      steps.push({
        action: `到达${res.entry}，观察门前有无异常、包裹或可疑人员`,
        touchpoint: '门铃摄像头 / 肉眼',
        thought: housingUsage === 'Airbnb' ? '客人能找到入口吗' : '有没有人在徘徊',
        friction: residential === '联排' ? '前门临街，暴露时间短' : '多入口难判断状态',
      });
      steps.push({
        action: `准备凭证（${profile.credential}），确认可正常解锁`,
        touchpoint: profile.credential,
        thought: person.name === '老人' ? '密码是多少来着' : '别又像上次识别失败',
        friction: person.name === '子女' ? '够不到键盘、指纹识别率低' : '雨水/手套影响识别',
      });
    } else if (g === '访客') {
      steps.push({
        action: '按约到达门前，户主可能尚未归来',
        touchpoint: '门铃 / 电话 / 短信',
        thought: '临时码在哪看？会不会输错',
        friction: '门外等待焦虑，户主无法及时应门',
      });
      steps.push({
        action: '查看临时码指引或按铃联系户主',
        touchpoint: '门锁键盘 / 门铃',
        thought: '希望一次成功进门',
        friction: '权限说明不清晰、通用码有泄露风险',
      });
    } else if (g === '服务人员') {
      steps.push({
        action: `按预约抵达（${person.name}），确认地址与时段`,
        touchpoint: '预约 App / 短信',
        thought: '户主今天在家吗',
        friction: '早到/迟到与权限窗口不匹配',
      });
      steps.push({
        action: '确认时段码有效，观察门前环境',
        touchpoint: '门锁 / 时段码',
        thought: person.name === '清洁' ? '今天有宠物吗' : '上次是这扇门吗',
        friction: house.mode,
      });
    } else if (g === '物流人员') {
      steps.push({
        action: '配送车停靠门前，核对地址与订单',
        touchpoint: '配送 App',
        thought: '时间紧，不能等太久',
        friction: '公寓需先过大堂门禁',
      });
      steps.push({
        action: '按铃或敲门，确认交付方式（门口/入室/当面）',
        touchpoint: '门铃 / 电话',
        thought: person.name === '外卖' ? '用户要求放门口还是当面' : '是否授权入室',
        friction: '户主不在家，等待成本',
      });
    }
  }

  if (phase === '开门') {
    if (g === '常住人') {
      steps.push({
        action: `使用${profile.credential}触发解锁`,
        touchpoint: '智能锁 / App',
        thought: person.name === '子女' ? '密码是几来着' : '快点开，手好累',
        friction: person.name === '子女' ? '儿童操作困难' : '双手占用无法操作',
      });
      steps.push({
        action: '拉门进入，注意防尾随',
        touchpoint: '门体 / 门磁',
        thought: '后面有没有人跟着',
        friction: res.risk,
      });
      steps.push({
        action: activity !== '无特定活动'
          ? `因「${activity}」需注意多入口与权限`
          : '确认锁体/App 反馈开门成功',
        touchpoint: '锁体 LED / App 推送',
        thought: '门会不会马上又锁上',
        friction: '无反馈时不确定状态',
      });
    } else if (g === '访客') {
      steps.push({
        action: '输入临时码或等待户主远程开门',
        touchpoint: '键盘 / App 远程',
        thought: '希望不用等太久',
        friction: '临时权限创建繁琐',
      });
      steps.push({
        action: '进入门廊，关闭身后大门',
        touchpoint: '门体',
        thought: '第一次来，规矩不太熟',
        friction: '尾随、权限范围不清',
      });
    } else if (g === '服务人员') {
      steps.push({
        action: '输入时段码进入，开始服务',
        touchpoint: '时段码',
        thought: '时间够不够做完',
        friction: '超时后权限失效',
      });
      steps.push({
        action: person.name === '遛狗' ? '取狗、准备出门' : '进入工作区域',
        touchpoint: '室内',
        thought: person.name === '遛狗' ? '狗会不会冲门' : '独自在屋内户主会担心',
        friction: '离开时是否锁门',
      });
    } else if (g === '物流人员') {
      steps.push({
        action: person.name === '快递' ? '按流程投递或获取短时入室权限' : '完成交付',
        touchpoint: '临时码 / 门口',
        thought: '拍照留证',
        friction: 'Porch Piracy 风险',
      });
      steps.push({
        action: '确认完成，离开门前',
        touchpoint: '配送 App',
        thought: '下一单要迟到',
        friction: '放错门、邻居误拿',
      });
    }
  }

  if (phase === '门内') {
    if (g === '常住人') {
      steps.push({
        action: event === '育儿' ? '安置孩子、检查课后物品' : '脱鞋、放包、安置随身物',
        touchpoint: '玄关',
        thought: '终于到家',
        friction: '匆忙时遗漏后续检查',
      });
      steps.push({
        action: '确认门已关严、未虚掩',
        touchpoint: '门磁 / App',
        thought: '门到底锁了没有',
        friction: '虚掩未察觉，宠物/儿童可能溜出',
      });
      steps.push({
        action: activity !== '无特定活动'
          ? `衔接室内「${activity}」活动`
          : `继续「${event}」相关室内安排`,
        touchpoint: '室内 / 家人',
        thought: person.name === '子女' ? '爸妈知道我到家的吧' : '家人知道我到了吗',
        friction: '状态未同步给家人',
      });
    } else if (g === '服务人员') {
      steps.push({
        action: person.name === '保姆' ? '接手育儿' : person.name === '清洁' ? '开始清洁' : '执行服务',
        touchpoint: '工作区域',
        thought: '有什么特别交代',
        friction: '孩子与陌生人同处',
      });
      steps.push({
        action: '服务中可能多次经过门口',
        touchpoint: '门',
        thought: '出去别忘了锁',
        friction: '短时多次开关门',
      });
    } else if (g === '物流人员') {
      steps.push({
        action: '将物品放至指定位置后离开',
        touchpoint: '室内指定点',
        thought: '不能碰其他区域',
        friction: '陌生人入内信任门槛',
      });
    } else if (g === '访客') {
      steps.push({
        action: activity === '派对' ? '与主人汇合' : '在客厅等候',
        touchpoint: '室内',
        thought: '主人还在忙别的',
        friction: '无人接待',
      });
    }
  }

  if (phase === '出门前') {
    if (g === '常住人') {
      steps.push({
        action: evt.rush ? '匆忙穿衣取物，检查钥匙/手机' : `为「${event}」做准备`,
        touchpoint: '室内',
        thought: evt.rush ? '要迟到了' : '别忘了锁门',
        friction: '多人出门节奏不同步',
      });
      steps.push({
        action: event === '倒垃圾' || event === '遛狗'
          ? '短时外出，评估是否带手机'
          : '设定离家模式/自动锁门预期',
        touchpoint: 'App / 安防面板',
        thought: event === '倒垃圾' ? '就一分钟，不用带手机吧' : '今天服务人员何时到',
        friction: event === '倒垃圾' ? '20 秒被锁门外' : '忘切换安防模式',
      });
      steps.push({
        action: '走向门口，确认无宠物/儿童跟随冲门',
        touchpoint: '门',
        thought: '狗会不会冲出来',
        friction: person.name === '老人' ? '行动不便' : '宠物冲门',
      });
    } else if (g === '服务人员') {
      steps.push({
        action: '完成服务，收拾准备离开',
        touchpoint: '工作区域',
        thought: '到点该走了',
        friction: '匆忙离开忘锁门',
      });
    }
  }

  if (phase === '离家') {
    steps.push({
      action: '拉门关闭，确认完全闭合',
      touchpoint: '门体 / 门磁',
      thought: '听到锁舌声了吗',
      friction: '门虚掩、被风吹开',
    });
    steps.push({
      action: g === '常住人' ? '等待自动上锁或手动确认' : '离开并确保已锁',
      touchpoint: '智能锁 / App',
      thought: '到底锁好了没',
      friction: '无推送确认，反复折返',
    });
    if (g === '常住人') {
      steps.push({
        action: '离开后查看 App 确认锁闭状态',
        touchpoint: '手机 App',
        thought: event === '通勤' ? '别又像上次忘锁' : '家中是否安全',
        friction: house.mode,
      });
    }
  }

  if (phase === '长期离家') {
    steps.push({
      action: '检查各入口锁闭，最小化临时权限',
      touchpoint: '所有门锁 / App',
      thought: '任何开门都应是异常',
      friction: '多入口难逐一确认',
    });
    steps.push({
      action: '启动度假/长期离家模式',
      touchpoint: 'App',
      thought: '希望不要误报',
      friction: '误报与漏报难平衡',
    });
  }

  if (phase === '居家') {
    steps.push({
      action: '在家中活动，可能 WFH 或育儿',
      touchpoint: '室内',
      thought: '门铃响了，谁在门口',
      friction: '会议/做饭时不便应门',
    });
    steps.push({
      action: '处理门口事件：快递、访客、服务人员',
      touchpoint: '门铃 / App 远程',
      thought: '要不要远程开门',
      friction: '难确认门外身份',
    });
  }

  if (phase === '夜间') {
    steps.push({
      action: '深夜接近门前，保持低噪',
      touchpoint: '门锁静音模式',
      thought: '别吵醒家人',
      friction: '开锁声过大',
    });
    steps.push({
      action: '安静进入，避免强光',
      touchpoint: '锁体 LED',
      thought: '外面有没有可疑的人',
      friction: '光线刺眼、安全感不足',
    });
  }

  if (steps.length === 0) {
    steps.push({
      action: `${person.name}在${phase}的典型门前行为`,
      touchpoint: profile.credential,
      thought: profile.goals?.[0] || '顺利完成',
      friction: res.risk,
    });
  }

  return steps;
}

function phaseGoal(phase, scenario) {
  const profile = PERSON_PROFILES[scenario.person.name];
  const goals = {
    回家前: profile ? `以「${profile.goals[0]}」为目标接近家门` : '安全接近门前',
    开门: `完成身份确认，顺利进入（事件：${scenario.event}）`,
    门内: scenario.activity !== '无特定活动'
      ? `在门内衔接「${scenario.activity}」`
      : '完成入户安置，确认门状态',
    出门前: `为「${scenario.event}」做好离开准备`,
    离家: '确认门已锁闭，安全离开',
    长期离家: '启动无人模式，远程可监控',
    居家: '居家时妥善处理门口事件',
    夜间: '安静、安全地完成夜间进出',
  };
  return goals[phase] || `${phase}阶段目标`;
}

function phaseEmotion(phase, scenario, isFocus) {
  let score = isFocus ? 0 : 1;
  if (scenario.person.name === '子女' && ['回家前', '开门'].includes(phase)) score -= 1;
  if (scenario.person.group === '物流人员' && phase === '开门') score -= 1;
  if (phase === '离家' && scenario.moment === '离家') score -= 1;
  if (phase === '门内' && scenario.moment === '门内') score += 1;
  const labels = ['焦虑', '紧张', '平稳', '安心'];
  return labels[Math.max(0, Math.min(3, score + 1))];
}

function momentOfTruth(scenario) {
  const { person, moment, housingUsage, event, activity } = scenario;
  if (person.name === '子女' && moment === '开门') return '孩子能否在无人协助下安全进门，且家长即时知晓';
  if (person.group === '物流人员' && moment === '开门') return '户主不在时，包裹/外卖能否安全完成交付';
  if (housingUsage === 'Airbnb' && moment === '开门') return '客人能否在正确时间自助入住，房东无需到场';
  if (activity === '派对') return '高频访客进出后，门是否全部锁闭、权限是否清零';
  if (activity === '装修') return '施工结束后是否彻底撤销所有工人权限';
  if (moment === '离家' && event === '通勤') return '匆忙出门时能否确认门已锁好';
  if (housingUsage === '空置' && moment === '长期离家') return '任何非授权开门能否立即触发告警';
  return `${person.name}在${moment}能否顺畅、安全地完成门前关键动作`;
}

export function buildDetailedJourney(scenario) {
  const phases = getJourneyPhases(scenario.moment);
  const profile = PERSON_PROFILES[scenario.person.name] || {
    role: scenario.person.group,
    goals: ['完成门前动作'],
    traits: [],
    credential: '—',
  };

  const journeyPhases = phases.map((phaseName) => {
    const meta = PHASE_META[phaseName] || { label: phaseName, icon: '•', desc: '' };
    const isFocus = phaseName === scenario.moment;
    return {
      phase: phaseName,
      label: meta.label,
      icon: meta.icon,
      desc: meta.desc,
      isFocus,
      goal: phaseGoal(phaseName, scenario),
      emotion: phaseEmotion(phaseName, scenario, isFocus),
      steps: buildPhaseSteps(phaseName, scenario),
    };
  });

  const rel = scenario.relevance;
  let score = rel > 70 ? 2 : rel > 45 ? 0 : -2;
  if (scenario.person.name === '子女' && scenario.moment === '开门') score -= 2;
  const labels = ['焦虑', '紧张', '平稳', '安心', '愉悦'];

  return {
    persona: {
      name: scenario.person.name,
      group: scenario.person.group,
      role: profile.role,
      goals: profile.goals,
      traits: profile.traits,
      credential: profile.credential,
    },
    context: {
      residential: RESIDENTIAL_CTX[scenario.residential],
      housing: HOUSING_CTX[scenario.housingUsage],
      event: EVENT_CTX[scenario.event],
    },
    phases: journeyPhases,
    focusMoment: scenario.moment,
    emotion: { label: labels[Math.max(0, Math.min(4, score + 2))] },
    mot: momentOfTruth(scenario),
  };
}
