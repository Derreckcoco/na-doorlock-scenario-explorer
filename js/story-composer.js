/**
 * 情境故事拼装引擎
 * 根据「人物 × 用房 × 住宅 × 事件 × 时刻」动态拼出具体故事线，再提取各阶段旅程步骤。
 * 不依赖固定查表，同一阶段在不同情境下应呈现不同叙事。
 */
import {
  mk, buildCtx, personArchetype, eventCategory, eventSceneForPhase,
  EVENT_CTX, RESIDENTIAL_CTX, HOUSING_CTX, PHASE_META,
} from './journey-data.js';

/**
 * 摩擦点：必须对应当前「时刻×事件×住宅×步骤」的具体麻烦，
 * 禁止直接粘贴 RESIDENTIAL_CTX.risk / HOUSING_CTX.friction 等元数据。
 */
function frictionFor(s, c, phase, hint) {
  const { event, residential: r } = s;
  const key = `${phase}|${event}|${hint}`;

  const table = {
    '回家前|约会|observe': {
      独栋: '车头灯只照得到前门，侧院和后门在暗处看不清',
      联排: '下车到门口只有几步，看不清街角是否有人跟着',
      公寓: '在停车场看不到单元门前的状况',
      豪宅: '车道太长，主入口前的状况从车里看不清',
      default: '天黑视线差，门前异常不易发现',
    },
    '回家前|约会|approach': { default: '聚会后精神放松，对门前异常的警觉性下降' },
    '回家前|娱乐|observe': { default: '疲惫状态下门前观察容易走过场' },
    '回家前|通勤|approach': {
      独栋: '车库门有没有关，坐在车里看不见',
      联排: '停车后走几步就到门，尾随者很容易贴身跟上',
      default: '下班太累，门前环视往往被跳过',
    },
    '回家前|通勤|observe': { default: '双手占满，没空掏手机看门铃回放' },
    '回家前|旅游|observe': {
      独栋: '离家多日，第一眼想确认侧院后门有没有撬痕',
      度假屋: '偏远路段灯光稀疏，门前异常更难第一时间发现',
      default: '离家久了，门前任何变化都让人紧张',
    },
    '回家前|出差|observe': { default: '深夜到家，脑子发懵，门前检查容易省略' },
    '回家前|接人|observe': { default: '迎客时门可能没关严，现在才想起来' },
    '回家前|取包裹|observe': { default: '包裹可能已被偷，门前空荡荡' },
    '开门|约会|unlock': { default: '指纹提示音或键盘背光在深夜格外刺耳' },
    '开门|通勤|unlock': { default: '手指沾汗或脏污，指纹识别可能一次不过' },
    '开门|通勤|enter': { default: '猫狗可能趁开门缝冲出去' },
    '开门|育儿|unlock': { default: '腾不出手输入密码或刷指纹' },
    '开门|上学|unlock': { default: '身高不够，密码面板够不着' },
    '开门|旅游|check': { default: '玄关有陌生脚印或异味，心里一沉' },
    '出门前|旅游|away_mode': {
      独栋: 'App 只管前门，车库门和后门没有联网',
      default: '度假模式设了，物理后门有没有关心里没底',
    },
    '出门前|通勤|ready': { default: '赶时间，锁门确认被压缩到最后一刻' },
    '出门前|约会|ready': { default: '出门前容易忘锁窗或切换安防模式' },
    '离家|通勤|lock': { default: '走远了才想起好像没听到锁舌声' },
    '离家|倒垃圾|lock': { default: '门在身后自动锁上，手机还在屋里' },
    '离家|旅游|lock': {
      独栋: '锁了前门，车库门有没有带下来不确定',
      default: '拖着行李走，来不及逐一确认每扇门',
    },
    '门内|日常|settle': { default: '进门后才发现还有一扇门没关' },
    '门内|派对|guest': { default: '客人陆续到达，后门可能被谁敞开忘了' },
    '长期离家|旅游|remote': {
      独栋: '推送只连着前门，后门开了可能无通知',
      default: '告警延迟几分钟，那几分钟里已经来不及反应',
    },
    '长期离家|装修|remote': { default: '施工期门常开，远程看不清现场全貌' },
    '夜间|约会|quiet': { default: '锁舌声在安静的夜里格外响' },
    '夜间|娱乐|quiet': { default: '深夜进门，任何声响都怕吵醒家人' },
  };

  const entry = table[key];
  if (entry) {
    if (typeof entry === 'string') return entry;
    return entry[r] || entry.default;
  }
  return null;
}

// ─── 住房 / 住宅情境修饰语 ─────────────────────────────────────────

function housingBeat(s, c, phase) {
  const h = s.housingUsage;
  const beats = {
    Airbnb: {
      开门: mk('核对入住/退房时间窗与门锁密码是否生效', '房东 App', '客人会不会早到或密码已过期', '密码窗口和实际到达时间差几分钟就尴尬'),
      居家: mk('远程查看是否有客人按门铃或清洁人员早到', '门铃摄像头', '差评往往从门口体验开始', '客人按铃没人应，转头就给差评'),
      长期离家: mk('确认下一波客人的入住码已预设、上一波权限已清', 'Airbnb 管理后台', '密码交接窗口有没有重叠', '两波客人权限撞车'),
    },
    租赁: {
      开门: mk('确认本次开门不会触发房东/物业的合规争议', '租约条款', '我有没有权利这样改门锁', '房东远程能看到进出记录，隐私别扭'),
      离家: mk('离开前回想退租时指纹/密码能否彻底清掉', '门锁 App', '房东会不会远程看到我进出', '退租后旧密码是否彻底清除不清楚'),
    },
    空置: {
      开门: mk('任何开门都按最高警戒处理，核对是否售房带看/维修预约', '告警 App', '这次开门合法吗', '误报太多会麻木，真入侵反而被忽略'),
      长期离家: mk('空置期间只接受白名单开门，其余一律告警', '远程监控', '希望不要误报', '漏报一次代价极大'),
    },
    商用: {
      开门: mk('营业时段开门需兼顾客户体验与后台安防', '前台/门锁', '客户会不会被锁在门外', '员工开门时客户体验被打断'),
      居家: mk('店内活动时门口动静会打断服务', '门铃', '要不要让员工去开门', '营业中离岗应门，排队客户抱怨'),
    },
  };
  return beats[h]?.[phase] || null;
}

function residentialBeat(s, c, phase) {
  const r = s.residential;
  const beats = {
    公寓: {
      回家前: mk('先在大堂门禁刷卡/呼叫，再上楼到单元门前', '大堂门禁', '快递经常上不来，我的包裹会不会也卡在楼下', '有人尾随进大堂时很难在电梯里甩开'),
      开门: mk('通过大堂后还需解锁单元门', '单元门锁', '手里拎东西时够不到密码面板', '邻居紧跟进来时来不及拦'),
    },
    联排: {
      回家前: mk('在临街停车位到前门只有几步', '街面', '开门瞬间全街都能看见', '下车走几步就到门，尾随者很容易贴身跟上'),
      开门: mk('拉门时留意街面是否有人跟随', '临街门', '后面有没有人跟着', '开门时间只有几秒，暴露窗口极短'),
    },
    豪宅: {
      开门: mk('先过车道门，再到主入口', '车道门 + 主门', '宾客和工人该走哪个入口', '两道门的权限搞混，客人卡在车道门'),
      离家: mk('离开前确认副门、侧门没有只关未锁', '多入口门磁', '员工通道有没有关', '员工通道常被忽略'),
    },
    ADU: {
      开门: mk('从后院独立小门进出，与主屋入口严格区分', 'ADU 侧门', '租户会不会误开主屋门', '两套权限容易搞混'),
    },
    度假屋: {
      长期离家: mk('偏远地区网络不稳，门锁离线时告警能否送达', '蜂窝备份', '整个冬天没人，任何开门都揪心', '离线期间开门完全无记录'),
      回家前: mk('长途驾驶后接近偏远度假屋', 'GPS', '周围几英里可能没人', '开了一路车，到门口才发现钥匙在行李最底层'),
    },
    '55+': {
      开门: mk('社区大门 + 单元门两道操作', '社区门禁', '步骤太多，手抖时容易按错', '访客流程太长，老人等不及'),
    },
  };
  return beats[r]?.[phase] || null;
}

// ─── 事件 × 阶段：核心故事节拍库 ─────────────────────────────────

function eventPhaseBeats(s, c, phase) {
  const e = s.event;
  const cat = eventCategory(e);
  const p = s.person.name;

  // ── 出门前 ──
  if (phase === '出门前') {
    if (cat === 'extended_absence') {
      if (p === '户主') {
        return [
          mk(`对照出行清单收拾行李：证件、充电器、常用药；同时检查${s.residential}水阀、电器插头、恒温器`, '行李箱 / 清单', '清单越长越容易漏项', c.evt.prep),
          mk('安排宠物寄养/请人浇花，并决定是否给照看者开临时门锁权限', '邻居 / 宠物店 / App', '权限给多久、回来后能不能记得撤销', '临时权限范围与回收是隐形负担'),
          mk(`在 App 为${s.housingUsage}房设置度假模式：异常开门推送、定时灯光`, '智能锁 App', '真出事了能不能第一时间知道', frictionFor(s, c, phase, 'away_mode') || '度假模式设了，物理后门有没有关心里没底'),
        ];
      }
      if (p === '配偶') {
        return [
          mk('和户主分工：谁关水阀、谁联系宠物寄养、谁设门锁度假模式', '共享备忘', '别两个人都以为对方做了', '双人协作遗漏'),
          mk(`确认${s.residential}门窗与${c.res.detail}入口都已检查`, '门窗 / 门磁', '这次出门比通勤久得多', c.evt.prep),
        ];
      }
    }
    if (e === '倒垃圾') {
      return [
        mk('抓起垃圾袋走向门口，心里默认「就两分钟」', '垃圾袋', '应该不用带手机吧', c.evt.pain),
        mk('瞥一眼门锁：是虚掩、手动锁还是会自动上锁', '智能锁', '回来会不会被挡在外面', '短时外出与自动锁策略冲突'),
      ];
    }
    if (e === '通勤' || e === '上学') {
      const rush = c.evt.rush;
      const isSchool = e === '上学';
      return [
        mk(
          rush
            ? `闹钟响后匆忙整装，抓起${isSchool ? '书包、午餐盒' : '公文包、车钥匙'}`
            : `为${e}整理${c.evt.hands}`,
          '卧室 / 玄关',
          rush ? '要迟到了' : '今天出门顺利吗',
          rush ? '匆忙时最易忘锁门' : '出门前容易漏掉门窗检查'
        ),
        mk(s.housingUsage === '租赁' ? '确认今天出门不会和房东巡检撞车' : '扫一眼门口有无异常', '门 / 窗外', '家里都准备好了吗', frictionFor(s, c, phase, 'ready') || '赶时间时门前检查被跳过'),
      ];
    }
    if (e === '育儿') {
      return [
        mk('一手整理孩子书包，一手检查婴儿车/安全座椅', '推车 / 书包', '千万别落下疫苗本', '双手占满，根本腾不出手操作锁'),
        mk('确认孩子穿好外套、门口没有宠物跟着冲出去', '玄关', '娃一兴奋就往门外跑', '儿童冲门是高频隐患'),
      ];
    }
    if (e === '派对' || e === '节日') {
      return [
        mk(`布置客厅与玄关迎宾区，预留客人挂外套、放礼物的位置`, '室内', '第一批客人几点到', '门口堆满杂物时通行效率骤降'),
        mk('为预期到访的亲友批量生成或检查临时门锁码的有效时段', 'App', '会不会有人带「额外的朋友」来', c.evt.pain),
        mk('确认食物配送或外卖到达时段与客人到达不冲突', '手机订单', '厨师和客人同时挤在门口', '多路人马在门口交汇'),
      ];
    }
    if (e === '装修') {
      return [
        mk('把贵重物品收进上锁房间，给施工队留出通道', '室内', '工人会不会乱翻抽屉', c.evt.pain),
        mk('在 App 核对施工队今日时段码与昨日是否同一批人', 'App', '换工人了怎么知道', '工人变动难以及时更新权限'),
      ];
    }
    if (e === '搬家') {
      return [
        mk('打包最后一箱，给搬家工人标注哪些门可以进出', '纸箱 / 便签', '冰箱和洗衣机谁负责', '多入口同时敞开'),
        mk('确认旧居钥匙交接、新居临时码已发给搬家队', '手机 / 工单', '工人会不会提前到', c.evt.pain),
      ];
    }
    if (e === '接人') {
      return [
        mk('整理门口区域，确认停车位置够客人下车', '车道 / 街面', '他们快到了吗', '人在门外等候时门未锁好形成空窗'),
        mk('决定是室内等候还是到门外迎接', '门', '要不要先把门打开透气', c.evt.pain),
      ];
    }
    if (cat === 'social') {
      return [
        mk(`整理仪容与${c.evt.hands}，确认今晚${e === '约会' ? '赴约' : '聚会'}路线`, '卧室 / 玄关', '会不会迟到', '出门前容易忘锁门或忘关窗'),
        mk(s.housingUsage === 'Airbnb' ? '确认今晚无人入住，安防模式是否切换' : '确认家中无人或家人已知你今晚晚归', 'App / 家人', '家里安全吗', frictionFor(s, c, phase, 'ready') || '出门前容易忘锁窗'),
      ];
    }
  }

  // ── 回家前 ──
  if (phase === '回家前') {
    if (personArchetype(p) === 'service') {
      return [
        mk(`按预约抵达${s.residential}（${s.housingUsage}）的${c.res.entry}`, '工单 / 短信', s.housingUsage === 'Airbnb' ? '上一波客人刚走' : '户主在不在家', '早到时段码未生效'),
        mk('核对工牌/时段码与门牌是否一致', '时段码', '别进错户', '这片区户型相似，容易敲错门'),
      ];
    }
    if (personArchetype(p) === 'logistics') {
      const apt = s.residential === '公寓';
      return [
        mk(`配送任务导航至${s.residential}${apt ? '，先解决大堂门禁' : ''}`, '配送 App', e === '取包裹' ? '用户可能在门口等' : '备注说放门口还是当面', apt ? '大堂上不去' : 'Porch Piracy 风险'),
      ];
    }
    if (cat === 'extended_absence') {
      return [
        mk(`结束${e}返程，${c.evt.scene}，接近${s.residential}`, '行李箱 / 导航', '家里这几天真的没事吗', c.evt.pain),
        mk(`在${c.res.entry}远处观察：门窗有无异常、门口有无滞留包裹`, '肉眼 / 门铃摄像头', '旅行后第一眼最怕看到异常', frictionFor(s, c, phase, 'observe') || '离家多日，任何门前变化都让人紧张'),
      ];
    }
    if (e === '上学' && p === '子女') {
      return [
        mk('放学后独自走向家，书包沉重', '书包', '密码是几来着', c.evt.pain),
        mk(s.residential === '公寓' ? '在大堂门禁前犹豫能否独立操作' : `到达${c.res.entry}`, '大堂门禁', '后面有人跟着吗', '儿童对尾随警觉性低'),
      ];
    }
    if (e === '接人') {
      return [
        mk(`接人结束后驾车返回${s.residential}，${c.evt.scene}`, '车内', '他们走了吗，门都锁好了吗', c.evt.pain),
        mk(`在${c.res.entry}前确认家中状态`, '门铃摄像头', '刚才迎客时门有没有关严', frictionFor(s, c, phase, 'observe') || '迎客时门可能没关严'),
      ];
    }
    if (cat === 'social') {
      return [
        mk(`结束「${e}」：${c.evt.scene}，驾车接近${s.residential}的${c.res.entry}`, '手机 / 车', `手里还拎着${c.evt.hands}`, frictionFor(s, c, phase, 'approach') || '社交后放松，警惕性下降'),
        mk(`在${c.res.entry}前放慢车速，先观察门前灯光与有无异常`, '门铃摄像头', e === '约会' ? '家人睡着了吗' : '家里现在方便进门吗', frictionFor(s, c, phase, 'observe') || c.evt.pain),
      ];
    }
    if (cat === 'daily_commute' || cat === 'errand') {
      return [
        mk(`结束「${e}」：${c.evt.scene}，接近${s.residential}的${c.res.entry}`, '手机 / 车', c.evt.rush ? `双手占着（${c.evt.hands}）` : '门前看起来正常吗', frictionFor(s, c, phase, 'approach') || c.evt.pain),
        mk(`在${c.res.entry}前检查有无异常包裹、陌生车辆`, '门铃摄像头', s.event === '取包裹' ? '快递是不是已经到了' : '今天门口有没有异常', frictionFor(s, c, phase, 'observe') || '天黑后门前细节看不清'),
      ];
    }
    if (e === '倒垃圾' || e === '遛狗') {
      return [
        mk(`${e === '倒垃圾' ? '倒完垃圾' : '遛完狗'}折返，手${e === '遛狗' ? '牵绳占着' : '拎着空袋'}`, '门外', '门还是刚才那样吗', c.evt.pain),
      ];
    }
  }

  // ── 开门 ──
  if (phase === '开门') {
    if (p === '子女') {
      return [
        mk('踮脚或摸索着输入密码/刷指纹', c.profile.credential, '别被同学看到密码', '身高不够、识别率低'),
        mk('快速拉门进入并反手关门', '门体', '绝对不能让陌生人跟进来', '儿童安全靠自觉'),
        mk('希望父母手机能弹出「孩子已到家」', 'App 推送', '他们怎么还没问我', '家长不知道孩子已进门'),
      ];
    }
    if (p === '老人') {
      return [
        mk('用指纹或简易密码缓慢开门，可能需多次尝试', c.profile.credential, '别把自己锁外面', '手抖、视力差按错键'),
        mk('进入后立刻关门，留意门外动静', '门体', '外面人多不安全', '反应慢，尾随风险高'),
      ];
    }
    if (p === '亲友') {
      return [
        mk('在门外查找临时码短信或等待户主远程开门', '手机 / 键盘', '千万别输错被锁', '临时权限指引不清'),
        mk(c.isHousehold ? `为「${e}」进入，${c.evt.scene}` : '进入门廊', '门体', '第一次来规矩不熟', '尾随、权限范围不清'),
      ];
    }
    if (p === '外卖') {
      return [
        mk('按门铃或敲门，等待应门', '门铃', '平台倒计时在走', '户主不在家/听不到'),
        mk(s.residential === '公寓' ? '在大堂电话呼叫住户' : '按备注放门口并拍照', 'App 相机', '别放错门', '无接触交付纠纷'),
      ];
    }
    if (p === '快递') {
      return [
        mk('按流程投递：门口放置或申请短时入室权', '临时码 / 门口', '下一单要迟到了', '投递与门锁事件未关联'),
        mk('拍照留证后离开', 'App', '别被投诉', 'Porch Piracy 后用户怪你没放好'),
      ];
    }
    if (p === '遛狗' && e === '遛狗') {
      return [
        mk('按精确时段码进门，狗可能兴奋冲向门口', '时段码', '别让狗跑出去', '宠物冲门导致门未关严'),
        mk('牵狗出门，关注门是否会自动锁上', '牵引绳', '回来还要再开一次', '短时外出自动锁风险'),
      ];
    }
    if (p === '维修人员' && e === '装修') {
      return [
        mk('施工队刷卡进入，门可能长时间敞开', '时段码', '今天换没换工人', c.evt.pain),
        mk('多人与工具同时进出，难以时刻关注门状态', '门 / 工具', '户主不在怎么确认安全', '施工期安防降级'),
      ];
    }
    if (cat === 'extended_absence') {
      return [
        mk(`拖着${c.evt.hands}在${c.res.entry}解锁`, c.profile.credential, '家里什么味道…有没有被动过的痕迹', c.evt.pain),
        mk('进门先环视玄关与客厅有无异常', '肉眼', '旅行后第一件事是确认安全', frictionFor(s, c, phase, 'check') || '玄关有陌生痕迹'),
      ];
    }
    if (e === '育儿') {
      if (p === '保姆') {
        return [
          mk('按工作日时段码到达，可能与孩子同时在门口', '时段码', '孩子会不会乱跑出门', '双重进出管理'),
          mk('进门后接手育儿，确认家长有无特别交代', '室内', '今天有什么要注意的', '家长不在时沟通不畅'),
        ];
      }
      if (personArchetype(p) === 'resident') {
        return [
          mk('一手抱娃一手试图开门，几乎无法操作', c.profile.credential, '要是能自动开就好了', c.evt.pain),
          mk('用肘或脚顶住门防止回弹', '门体', '娃别乱动门把手', '双手占满是常态'),
        ];
      }
    }
    // 常住人通用开门
    if (personArchetype(p) === 'resident') {
      return [
        mk(`在${c.res.entry}用${c.profile.credential}解锁`, '智能锁', c.evt.rush ? '快点，手占满了' : '确认门后无人尾随', frictionFor(s, c, phase, 'unlock') || '手指沾汗识别可能失败'),
        mk(`拉门进入${s.residential}玄关`, '门磁', s.residential === '公寓' ? '大堂门关好了吗' : '宠物会不会冲出去', frictionFor(s, c, phase, 'enter') || '宠物趁开门缝冲出去'),
        mk('查看 App 确认开门记录已生成', 'App', '这次锁会不会马上又自动上锁', c.house.note),
      ];
    }
  }

  // ── 门内 ──
  if (phase === '门内') {
    if (e === '育儿') {
      return [
        mk('放下孩子/推车，检查课后作业与明天物品', '玄关 / 厨房', '终于安顿下来了', '一手带娃一手收拾'),
        mk('若独自在家，教孩子不开门给陌生人', '门', '门铃响了怎么办', '家长未教清应对流程'),
      ];
    }
    if (e === '派对' || e === '节日') {
      return [
        mk('客人陆续到达，玄关堆满外套和礼物', '玄关', '下一位客人几点到', '陌生人混入难以及时发现'),
        mk('协调客人停车、脱鞋、儿童在门口玩耍', '室内 / 门口', '孩子别跑出门外', c.evt.pain),
      ];
    }
    if (e === '装修') {
      return [
        mk('施工噪音与粉尘弥漫，门常开以搬运建材', '室内', '工人会不会去不该去的房间', c.evt.pain),
        mk('户主若在家，需兼顾监工与正常生活节奏', '室内', '这状态要持续几周', '安防长期处于降级状态'),
      ];
    }
    if (e === '搬家') {
      return [
        mk('纸箱堆满玄关，工人与家人穿梭搬运', '玄关 / 过道', '旧物别搬错', '门长时间敞开、人员混杂'),
        mk('核对贵重物品是否已收好', '卧室', '陌生人进出太多', c.evt.pain),
      ];
    }
    if (p === '保姆' && e === '育儿') {
      return [
        mk('独自带娃时听到门铃：快递还是陌生人', '门铃', '爸妈说不能乱开门', '应门规则未授权'),
        mk('孩子午睡，需在不吵醒的前提下处理门口', '室内', '要不要远程问家长', '一人应门分身乏术'),
      ];
    }
    if (p === '清洁') {
      return [
        mk('独自清洁中多次经过门口，可能临时外出倒垃圾', '门', '户主摄像头在录吗', '离开时是否锁门'),
        mk('完成清洁准备离开，收拾工具', '室内', '到点了', '匆忙忘锁'),
      ];
    }
    return [
      mk(`安置${c.evt.hands}，在玄关脱鞋换鞋`, '玄关', '终于到家', '匆忙时忘记后续检查'),
      mk(`确认屋内门窗状态`, '门磁 / App', '所有门都关严了吗', frictionFor(s, c, phase, 'settle') || '进门后才发现还有窗没关'),
      mk(c.isHousehold ? `衔接「${e}」：${c.evt.scene}` : `处理「${e}」后续室内安排`, '室内', '家人知道我到家了吗', '家人不知道我已到家'),
    ];
  }

  // ── 离家 ──
  if (phase === '离家') {
    if (e === '倒垃圾') {
      return [
        mk('拉门出去，门在身后关上', '门体', '就两分钟', '自动锁已启动'),
        mk('走到垃圾桶，突然想：带手机了吗', '口袋', '如果没锁好怎么办', c.evt.pain),
      ];
    }
    if (cat === 'daily_commute') {
      return [
        mk(`拉闭${c.res.entry}，确认完全咬合`, '门磁', '听到锁舌声了吗', '门虚掩、被风吹开'),
        mk('等待自动上锁或手动确认', '智能锁', '到底锁好了没', '无推送确认，想折返'),
        mk('赶时间离开，心里默念「应该锁了吧」', '手机 App', '别又像上次忘锁', c.evt.pain),
      ];
    }
    if (cat === 'extended_absence') {
      return [
        mk(`逐一锁闭各入口`, '全部门锁', '任何入口都不能漏', frictionFor(s, c, phase, 'lock') || '拖着行李走，来不及逐一确认'),
        mk('启动长期离家/度假模式', 'App', '希望不要误报', c.evt.pain),
        mk('拖着行李离开，不时回头看门', '车道', '这次真的都锁好了吗', '走远后才开始怀疑刚才有没有锁好'),
      ];
    }
    if (p === '清洁' || p === '保姆') {
      return [
        mk('完成工作，确认锁门并结束工单', '锁 / App', '户主会收到通知吗', '离开后锁状态不确定'),
      ];
    }
    return [
      mk(`拉闭${c.res.entry}，确认完全咬合`, '门磁', '听到锁舌声了吗', '门虚掩、被风吹开'),
      mk('等待自动上锁或手动确认', '智能锁', '到底锁好了没', '无推送确认，想折返'),
      mk(`离开${s.residential}后查看 App`, '手机 App', '锁好了吗', frictionFor(s, c, phase, 'lock') || 'App 没推送锁门确认'),
    ];
  }

  // ── 长期离家 ──
  if (phase === '长期离家') {
    if (e === '装修') {
      return [
        mk('远程查看施工队今日开门记录是否都在预约时段内', 'App', '有没有非授权开门', c.evt.pain),
        mk('收到异常推送时判断是工人还是入侵', '手机通知', '要不要报警', '施工期误报与漏报都难处理'),
      ];
    }
    if (cat === 'extended_absence') {
      return [
        mk(`在途中打开 App 查看${s.residential}门锁状态`, 'App', '家里现在怎么样了', c.evt.pain),
        mk('收到开门推送时辨认是邻居代收还是异常', '推送', '宠物店的人今天去了吗', '合法开门与异常开门难区分'),
        mk(s.housingUsage === '度假屋' ? '担心偏远地区设备离线' : '回想出门前清单有没有漏项', '设备状态', '网络断了谁知道', frictionFor(s, c, phase, 'remote') || '告警延迟让人不安'),
      ];
    }
    return [
      mk(`检查所有入口的锁状态`, '全部门锁', '任何开门都应是异常', frictionFor(s, c, phase, 'remote') || '远程看不清每扇门的状态'),
      mk(`为${s.housingUsage}房启动长期离家模式`, 'App', '希望不要误报', '远程权限忘了撤销'),
    ];
  }

  // ── 居家 ──
  if (phase === '居家') {
    if (e === '取包裹') {
      return [
        mk('手机弹出快递到达通知，但人正在厨房/开会', '手机', '现在去开门吗', '通知与门锁事件未联动'),
        mk('通过门铃摄像头确认是快递员而非陌生人', '门铃 / App', '要不要远程开锁', '难确认门外身份'),
        mk('决定让快递员放门口还是授权短时入室', 'App', '放门口会不会被偷', 'Porch Piracy'),
      ];
    }
    if (e === '育儿') {
      return [
        mk('独自带娃时门铃响：快递、邻居还是陌生人', '门铃', '爸妈说不能开门', '应门规则不清'),
        mk('抱着孩子挪到门边查看猫眼/摄像头', '门铃屏幕', '这个人认识吗', '一手抱娃无法开门'),
      ];
    }
    if (e === '派对' || e === '节日') {
      return [
        mk('家中热闹，门口不断有人按铃到访', '门铃', '是不是预约的那位', '陌生人混入'),
        mk('协调客人进出，防止后门长时间敞开', '室内 / 后门', '散场后别忘了清权限', c.evt.pain),
      ];
    }
    if (e === '装修') {
      return [
        mk('在家中正常生活，但门口不断有工人进出', '门', '这状态还要多久', c.evt.pain),
      ];
    }
    return [
      mk(`在${s.residential}家中活动，门铃突然响了`, '门铃', '谁在门口', c.isHousehold ? c.evt.pain : '会议/做饭时不便应门'),
      mk('通过摄像头/App 判断要不要应门', '门铃 / App', '要不要远程开门', '难确认门外身份'),
    ];
  }

  // ── 夜间 ──
  if (phase === '夜间') {
    if (cat === 'social' || e === '娱乐') {
      return [
        mk(`深夜结束「${e}」接近${c.res.entry}`, '静音模式锁', '别吵醒家人', '开锁声过大'),
        mk('低噪开门，避免门铃摄像头补光灯刺眼', '锁体 LED', '外面有没有可疑的人', '深夜安全感不足'),
      ];
    }
    if (p === '配偶') {
      return [
        mk('加班后深夜回家，尽量安静开门', '静音锁', '孩子刚睡着', '开锁提示音吵醒家人'),
      ];
    }
    if (p === '子女') {
      return [
        mk('青少年晚归，悄悄输入密码', '键盘', '别被爸妈发现太晚', '晚归与家庭规则冲突'),
      ];
    }
    return [
      mk(`夜间在${c.res.entry}解锁`, '静音模式锁', '别发出太大动静', '开锁声过大'),
      mk('留意门外动静后再关门', '门体', '这片晚上安全吗', frictionFor(s, c, phase, 'quiet') || '深夜门外动静让人紧张'),
    ];
  }

  return null;
}

// ─── 人物专属补充节拍 ─────────────────────────────────────────────

function personBeat(s, c, phase) {
  const p = s.person.name;
  if (p === '邻居' && phase === '开门') {
    return mk('使用一次性紧急授权码进入', '临时码', '别进错门', '低频使用易出错');
  }
  if (p === '物业' && phase === '开门') {
    return mk('按规程刷卡进入并上传巡检记录', '物业码', '别引发租客投诉', '进入通知不及时');
  }
  if (p === '物流' && phase === '开门') {
    return mk(s.event === '搬家' ? '搬家队同时开多道门卸货' : '开车库门卸大件', '临时码 / 车库门', '外人混杂', '安防真空期');
  }
  return null;
}

// ─── 主入口：拼装某阶段的完整步骤 ─────────────────────────────────

export function composePhaseSteps(scenario, phase) {
  const c = buildCtx(scenario);
  const steps = [];

  const core = eventPhaseBeats(scenario, c, phase);
  if (core?.length) steps.push(...core);

  const hBeat = housingBeat(scenario, c, phase);
  if (hBeat && !steps.some((st) => st.action === hBeat.action)) steps.push(hBeat);

  const rBeat = residentialBeat(scenario, c, phase);
  if (rBeat && !steps.some((st) => st.action === rBeat.action)) steps.push(rBeat);

  const pBeat = personBeat(scenario, c, phase);
  if (pBeat && !steps.some((st) => st.action === pBeat.action)) steps.push(pBeat);

  if (steps.length === 0) {
    steps.push(
      mk(
        `${scenario.person.name}在${scenario.residential}（${scenario.housingUsage}）的${phase}阶段，因「${scenario.event}」产生门前行为`,
        c.profile.credential,
        c.profile.goals[0] || '顺利完成',
        c.evt.pain || '这一步比预想更麻烦'
      )
    );
  }

  return steps.slice(0, 4);
}

/** 紧扣当前场景的目标（1-2 条，不用人物画像里的通用目标） */
export function composeScenarioGoals(scenario) {
  const { person, event, moment, residential, housingUsage } = scenario;
  const c = buildCtx(scenario);
  const p = person.name;
  const key = `${moment}|${event}`;

  const table = {
    '回家前|约会': ['确认门前无异常后安静入户', '不吵醒已入睡的家人'],
    '回家前|娱乐': ['疲惫状态下仍完成门前安全检查', '深夜进门不打扰家人休息'],
    '回家前|见朋友': ['确认家中是否有人等候或需留门', '安全进入后再处理伴手礼'],
    '回家前|通勤': ['双手占物时尽快完成解锁进门', '确认未被尾随'],
    '回家前|旅游': ['长途返程后第一时间确认家中是否被侵入', '拖着行李安全进入'],
    '回家前|出差': ['深夜/清晨到家时确认家中安防状态', '快速判断家中是否有异常'],
    '出门前|旅游': ['落实水电气、宠物、邮件等离家清单', '设置好度假模式与临时权限'],
    '出门前|出差': ['在有限时间内完成离家安防配置', '确认照看安排已到位'],
    '出门前|倒垃圾': ['两分钟内完成倒垃圾并返回', '不被自动锁挡在门外'],
    '出门前|通勤': ['准时出门且不遗漏锁门确认', '匆忙中保持门前安全意识'],
    '出门前|育儿': ['带娃出门时不让儿童独自留在门口', '一手抱娃仍能完成锁门操作'],
    '开门|育儿': ['抱娃/推车时仍能顺利开门', '防止儿童或宠物冲门'],
    '开门|上学': ['独自完成开门并确认安全关门', '不让陌生人跟随进入'],
    '居家|取包裹': ['及时响应门口快递通知', '在不便离身时完成安全交付'],
    '居家|育儿': ['独自带娃时正确处理门口来访', '不让孩子给陌生人开门'],
    '离家|通勤': ['确认已锁门后再赶路上班', '获得明确的锁门状态反馈'],
    '长期离家|旅游': ['离家期间掌握家中开门动态', '异常开门能第一时间知晓'],
    '长期离家|装修': ['远程确认施工队进出合规', '工人权限无遗漏'],
  };

  if (table[key]) return table[key];

  if (personArchetype(p) === 'logistics' && moment === '开门') {
    return ['在时限内完成交付', '留证并避免纠纷'];
  }
  if (personArchetype(p) === 'service' && moment === '开门') {
    return ['在预约时段内合法进入', '离开时确认门已锁好'];
  }
  if (personArchetype(p) === 'visitor') {
    return ['按约进入且不长时间门外等待', '离开后不留残留权限'];
  }

  return [
    `在${moment}顺利完成「${event}」相关的门前动作`,
    `确保${residential}门前这一步不出差错`,
  ].slice(0, 2);
}

/** 用户状态：一句话描述此刻情境，无套话 */
export function composeUserState(scenario) {
  const { person, event, moment, residential, housingUsage } = scenario;
  const c = buildCtx(scenario);
  const scene = eventSceneForPhase(event, moment);
  const p = person.name;

  const states = {
    '回家前|约会': `${p}晚间约会后驾车回到${housingUsage}的${residential}，正接近${c.res.entry}，需先确认门前正常`,
    '回家前|娱乐': `${p}看电影/运动后深夜回到${residential}门前，疲惫但仍需完成安全检查`,
    '出门前|旅游': `${p}在${residential}内收拾行李，同时处理水电气、宠物与安防设置`,
    '出门前|倒垃圾': `${p}抓起垃圾袋准备出门，默认只离开两三分钟`,
    '居家|取包裹': `${p}在${residential}家中，收到快递到达通知但可能正在忙碌`,
    '开门|育儿': `${p}一手抱娃/推车在${c.res.entry}前，几乎无法腾出手操作锁`,
  };

  const k = `${moment}|${event}`;
  if (states[k]) return states[k];

  if (personArchetype(p) === 'service') {
    return `${p}按约到达${housingUsage}的${residential}（${scene}），等待进入或正在作业`;
  }
  if (personArchetype(p) === 'logistics') {
    return `${p}为「${event}」抵达${residential}门前，需在规定时间内完成交付`;
  }
  if (personArchetype(p) === 'visitor') {
    return `${p}受邀来到${housingUsage}的${residential}（${scene}），${PHASE_META[moment]?.desc || ''}`;
  }

  return `${p}在${housingUsage}的${residential}，${scene}，处于「${moment}」`;
}

/** 情绪：针对当前场景，含标签与原因 */
export function composeScenarioEmotion(scenario) {
  const { person, event, moment, residential, housingUsage } = scenario;
  const p = person.name;
  const key = `${moment}|${event}|${housingUsage}`;

  const specific = {
    '回家前|约会|自住': { label: '满足中带克制', reason: '约会后心情放松，但深夜回家需压低开门声，担心吵醒家人' },
    '回家前|约会|租赁': { label: '放松但警觉', reason: '晚归需安静进门，同时顾虑租客身份下的门前安全' },
    '回家前|娱乐|自住': { label: '疲惫+警觉', reason: '娱乐后身体疲惫，但仍需完成门前观察才能安心' },
    '回家前|通勤|自住': { label: '急切', reason: '下班高峰双手占物，只想快点进门，易忽略门前检查' },
    '回家前|旅游|自住': { label: '忐忑', reason: '长途旅行后第一眼最怕看到门窗或门前有异常' },
    '出门前|旅游|自住': { label: '忙碌焦虑', reason: '出行清单冗长，安防设置容易被排在最后匆忙完成' },
    '出门前|倒垃圾|自住': { label: '随意', reason: '默认只出去两分钟，对锁门和带手机警惕性最低' },
    '出门前|通勤|自住': { label: '匆忙', reason: '赶时间出门，锁门确认容易被压缩到最后一刻' },
    '开门|育儿|自住': { label: '窘迫', reason: '双手抱娃几乎无法操作锁，门一开孩子还可能往门外跑' },
    '开门|上学|自住': { label: '紧张', reason: '独自操作锁，担心密码记不住或被陌生人尾随' },
    '居家|取包裹|自住': { label: '两难', reason: '想及时取件，但正在做饭/开会不便冲到门口' },
    '长期离家|旅游|自住': { label: '牵挂', reason: '人已在旅途，仍忍不住惦记家里门锁和异常推送' },
    '长期离家|装修|自住': { label: '不安', reason: '施工期门常开、人员混杂，远程难以掌握全貌' },
    '夜间|约会|自住': { label: '克制', reason: '约会晚归，每一步都要控制声音和光线' },
  };

  if (specific[key]) return specific[key];

  const fallbackKey = `${moment}|${event}`;
  const fallback = {
    '回家前|约会': { label: '满足中带克制', reason: '社交后放松，但晚归需安静进门不打扰他人' },
    '回家前|出差': { label: '疲惫+警觉', reason: '差旅后身体疲惫，仍担心离家期间家中是否异常' },
    '出门前|出差': { label: '紧迫', reason: '临近出发，安防和照看安排容易草草了事' },
    '开门|派对': { label: '兴奋', reason: '客人陆续到达，门口人流混杂难以辨认' },
    '门内|派对': { label: '忙碌', reason: '聚会进行中，需同时照顾客人与门的状态' },
    '离家|倒垃圾': { label: '随意', reason: '以为马上回来，对门是否锁好并不上心' },
  };
  if (fallback[fallbackKey]) return fallback[fallbackKey];

  if (personArchetype(p) === 'logistics' && moment === '开门') {
    return { label: '焦急', reason: '配送时限紧，户主不应门或门禁受阻会直接影响完成率' };
  }
  if (housingUsage === '空置' && ['开门', '长期离家'].includes(moment)) {
    return { label: '高度警觉', reason: '空置房任何开门都可能是入侵，不能掉以轻心' };
  }
  if (housingUsage === 'Airbnb' && moment === '开门') {
    return { label: '紧张', reason: '密码窗口、客人早到迟退直接影响入住体验' };
  }

  return {
    label: scenario.relevance > 70 ? '专注' : '平稳',
    reason: `在${residential}·${housingUsage}的${moment}（${event}）下，${p}以完成为主、保持基本警觉`,
  };
}

/** 可能痛点：紧扣情境，且不与旅程步骤中的摩擦重复 */
export function composePainPoints(scenario, focusSteps = []) {
  const { person, event, moment, residential, housingUsage } = scenario;
  const c = buildCtx(scenario);
  const pains = [];
  const frictionTexts = new Set(focusSteps.map((s) => s.friction));

  const add = (text) => {
    if (!text || frictionTexts.has(text)) return;
    if (pains.some((p) => p.includes(text) || text.includes(p))) return;
    pains.push(text);
  };

  const combo = {
    '回家前|约会': [
      '智能锁解锁声/提示灯在深夜过于突兀',
      '双手拎物时无法同时操作手机查看门前摄像头',
      residential === '独栋' ? '侧院和后门在暗处，摄像头照不到' : null,
    ],
    '出门前|旅游': [
      '出行清单过长，安防设置常被遗漏',
      '给邻居/寄养者的临时权限回来后忘记撤销',
      housingUsage === '度假屋' ? '偏远地区网络不稳，离线时无法收到告警' : null,
    ],
    '出门前|倒垃圾': [
      '「就一分钟」心理导致不锁门或不带手机',
      '自动锁在返回时把人挡在门外',
    ],
    '居家|取包裹': [
      '快递通知与门锁/门铃事件未联动',
      '不愿开门时包裹放门口有被盗风险',
    ],
    '开门|育儿': [
      '抱娃时无法使用指纹/密码/手机开锁',
      '开门瞬间儿童或宠物可能冲出门外',
    ],
  };

  const k = `${moment}|${event}`;
  if (combo[k]) combo[k].forEach(add);

  if (housingUsage === 'Airbnb' && moment === '开门') add('客人早到/迟退与密码时间窗不匹配');
  if (housingUsage === '空置' && ['开门', '长期离家'].includes(moment)) add('空置期任何开门需立即告警，漏报代价大');
  if (event === '装修' && person.group === '服务人员') add('施工队多日进出，权限回收极易遗漏');
  if (residential === '公寓' && person.group === '物流人员') add('大堂门禁阻隔，投递时限内难上楼');

  if (pains.length === 0) add(c.evt.pain);

  // 事件痛点已被旅程「麻烦点」占用时，从内心活动提炼产品视角痛点（不与麻烦点字面重复）
  if (pains.length === 0) {
    for (const st of focusSteps) {
      if (!st.thought) continue;
      const worry = st.thought.replace(/^「|」$/g, '');
      add(`难以实时确认：${worry}`);
      break;
    }
  }

  return pains.filter(Boolean).slice(0, 4);
}

/** 列表卡片一行摘要：具体描述「可能出什么问题」，禁止「存在门前摩擦」类空话 */
export function composeListPreview(scenario) {
  const steps = composePhaseSteps(scenario, scenario.moment);
  const pains = composePainPoints(scenario, steps);
  const explicitPain = pains.find((p) => !p.startsWith('难以实时确认：'));
  if (explicitPain) return explicitPain;

  const friction = steps.map((s) => s.friction).find(Boolean);
  if (friction) return friction;

  if (pains[0]) return pains[0];

  const c = buildCtx(scenario);
  if (c.evt?.pain) return c.evt.pain;

  const { person, moment, event, residential } = scenario;
  return `${person.name}在${residential}·${moment}做「${event}」时，门前状态不易确认`;
}

/** 一句话故事线（精简版，用于内部，卡片展示改用 userState） */
export function composeStoryline(scenario) {
  return composeUserState(scenario);
}

export function composePhaseGoal(scenario, phase) {
  const c = buildCtx(scenario);
  const p = scenario.person.name;
  const goals = {
    回家前: `${p}因「${scenario.event}」接近${scenario.residential}（${scenario.housingUsage}）`,
    开门: `${p}在${c.res.entry}完成通行（${c.profile.credential}）`,
    门内: c.isHousehold
      ? `在${scenario.residential}内衔接「${scenario.event}」：${c.evt.scene}`
      : `完成${scenario.event}后的入户安置`,
    出门前: `为「${scenario.event}」离开${scenario.housingUsage}的${scenario.residential}`,
    离家: `确认${c.res.detail}已锁闭后安全离开`,
    长期离家: `${scenario.housingUsage}场景下远程守护门前安全`,
    居家: `在${scenario.residential}内处理与「${scenario.event}」相关的门口事件`,
    夜间: `${p}低噪完成夜间门前通行`,
  };
  return goals[phase] || `${phase}阶段`;
}

export function composePhaseEmotion(scenario, phase, isFocus) {
  let score = isFocus ? 0 : 1;
  if (scenario.person.name === '子女' && ['回家前', '开门'].includes(phase)) score -= 1;
  if (scenario.person.name === '老人') score -= 1;
  if (scenario.person.group === '物流人员' && phase === '开门') score -= 1;
  if (scenario.housingUsage === '空置' && phase === '长期离家') score -= 2;
  if (scenario.housingUsage === 'Airbnb' && phase === '开门') score -= 1;
  if (scenario.event === '倒垃圾' && phase === '出门前') score += 1;
  if (scenario.event === '旅游' && phase === '长期离家') score -= 1;
  const labels = ['焦虑', '紧张', '平稳', '安心'];
  return labels[Math.max(0, Math.min(3, score + 1))];
}

export function composeMomentOfTruth(scenario) {
  const { person, moment, housingUsage, residential, event } = scenario;
  if (person.name === '子女' && moment === '开门')
    return `孩子能否在${residential}独自用${EVENT_CTX[event]?.hands || '书包'}顺利进门，且家长即时知晓`;
  if (person.name === '老人' && moment === '开门')
    return `老人能否在${residential}无需帮助独立完成开门，子女能远程确认安全`;
  if (person.name === '快递' && moment === '开门')
    return `户主不在${residential}时，${event === '取包裹' ? '包裹' : '快件'}能否安全交付且留证`;
  if (housingUsage === 'Airbnb' && moment === '开门')
    return `客人能否在${residential}按入住窗口自助进门，房东无需到场`;
  if (housingUsage === '空置' && moment === '长期离家')
    return `${residential}空置期间任何非授权开门能否立即告警`;
  if (event === '派对' || event === '节日') return `「${event}」散场后${residential}所有入口是否锁闭、临时权限是否清零`;
  if (event === '装修') return `施工结束后${residential}工人权限是否彻底撤销`;
  if (event === '搬家') return `搬家结束后${residential}安防是否恢复常态`;
  if (moment === '离家' && event === '通勤')
    return `匆忙通勤出门时，${person.name}能否确认${residential}已锁好`;
  if (moment === '出门前' && event === '倒垃圾')
    return `倒垃圾 2 分钟返回时，${person.name}是否不会被${residential}的自动锁挡在门外`;
  if (moment === '居家' && event === '取包裹')
    return `在家时能否及时响应${residential}门口的快递并按需授权`;
  if (moment === '出门前' && (event === '旅游' || event === '出差'))
    return `出发前的水电/宠物/权限清单是否都落实，${person.name}能否安心离家`;
  if (person.name === '遛狗' && event === '遛狗')
    return `遛狗员短时取狗/还狗时，${residential}的门能否既防止宠物冲出又不误锁自己在外`;
  const eventLabel = person.name === event ? '此次上门' : `「${event}」`;
  return `${person.name}在${residential}·${housingUsage}执行${eventLabel}时，能否顺畅完成${moment}这一步的关键门前动作`;
}
