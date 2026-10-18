/* 仅把已有病种转换成准确反馈，不修改诊疗费用、时序、数值或处方规则。 */
function __hostClinicFeedback(issue, name, phase) {
  const messages = {
    sniffles: {
      start: '小猫有小感冒：先量体温，再听诊和检查。完成三个步骤后才收取诊疗费用。',
      journal: '完成小感冒诊疗，打喷嚏的症状已经缓解。',
      result: '小感冒诊疗完成，小猫恢复健康啦。'
    },
    tummy: {
      start: '小猫肚子不舒服：先量体温，再听诊和检查。完成三个步骤后才收取诊疗费用。',
      journal: '完成肠胃不适诊疗，肚子已经舒服啦。',
      result: '肠胃不适诊疗完成，小猫恢复健康啦。'
    },
    healthy: {
      start: '这次是健康体检：先量体温，再完成三个检查步骤。检查完成才收费。',
      journal: '完成了一次健康体检。',
      result: '检查结束，小猫很健康，继续一起生活吧。'
    },
    unknown: {
      start: '小猫有不适：先量体温，再完成医生的三个检查步骤。检查完成才收费。',
      journal: '完成诊疗，小猫恢复健康啦。',
      result: '诊疗完成，小猫恢复健康啦。'
    }
  };
  const kind = issue === null || issue === undefined ? 'healthy' : Object.hasOwn(messages, issue) ? issue : 'unknown';
  const text = messages[kind][phase];
  if (typeof text !== 'string') throw new Error('未知诊疗反馈阶段。');
  return phase === 'journal' ? String(name) + text : text;
}
