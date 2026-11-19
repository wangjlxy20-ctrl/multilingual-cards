// console.log('script.js loaded successfully.');

// //测试 DOM 操作---选中输入框，改提示文字；
// const wordInput = document.querySelector('#word-input');
// console.log('I find the wordInput:', wordInput);

// //绑定第一个事件
// const searchBtn = document.querySelector('#search-btn');
// searchBtn.addEventListener('click', () => {
//     alert('searchBtn clicked');
// });


// ============================================
// ============================================
// 语言配置表
// ============================================
// ============================================
const LANGS = {
  en: { name: 'English', flag: '🇺🇸', speechLang: 'en-US' },
  ja: { name: 'Japanese', flag: '🇯🇵', speechLang: 'ja-JP' },
  ko: { name: 'Korean', flag: '🇰🇷', speechLang: 'ko-KR' },
  de: { name: 'German', flag: '🇩🇪', speechLang: 'de-DE' },
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'en',  label: '🇺🇸 英语' },
  { dynamic: true },   // 日/韩/德按 vocabCards 里实际有卡的语言动态生成
];



// ============================================
// ============================================
// 数据区
// ============================================
// ============================================
let currentLang = 'en';   // 默认英语
// 生词本卡片数组：启动时从 localStorage 取回；没有就给空数组
let vocabCards = JSON.parse(localStorage.getItem('vocabCards') || '[]');

let currentCard = null;   // 当前查到的词，收藏时用它
let currentFilter = 'all';   // 当前分类筛子：'all' / 'en' / 'ja' / ...




// ============================================
// ============================================
// DOM 元素引用
// ============================================
// ============================================
const langSelect = document.querySelector('#lang-select');
const wordInput  = document.querySelector('#word-input');
const searchBtn  = document.querySelector('#search-btn');
const speakBtn   = document.querySelector('#speak-btn');
const saveBtn    = document.querySelector('#save-btn');
const resultBox  = document.querySelector('#result');



// ============================================
// ============================================
// 函数：根据当前语言刷新界面
// ============================================
// ============================================


// ============================================
// 朗读函数
// ============================================
function speak(text, langOverride) {          // ⭐ 第二个参数：可选
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langOverride || LANGS[currentLang].speechLang;  // 有指定用指定，没有用当前
  speechSynthesis.cancel();                   // ⭐ 打断上一次朗读，防止两句话叠一起
  speechSynthesis.speak(u);
}

// ============================================
// 翻译函数（释义 → 中文）
// ============================================
async function translateToChinese(text) {
  // encodeURIComponent：把中日文等特殊字符转成合法 URL 编码
  // slice(0, 300)：MyMemory 单次请求限 500 字节，长释义先截断防出错
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 300))}&langpair=${currentLang}|zh-CN`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('翻译服务出错');
    const data = await res.json();
    return data.responseData?.translatedText || null;
  } catch (err) {
    console.error('❌ 翻译失败：', err);
    return null;  
  }
}

// ============================================
// 查词函数
// ============================================
async function lookupWord(word) {
  const url = `https://freedictionaryapi.com/api/v1/entries/${currentLang}/${word}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('服务器没找到这个单词');
    const data = await res.json();

    // 把第一条释义送去翻译
    const def = data.entries?.[0]?.senses?.[0]?.definition;
    if (def) {
      data.chineseDef = await translateToChinese(def);   // 挂到 data 上一起带回
    }

    return data;
  } catch (err) {
    console.error('❌ 查询失败：', err);
    return null;
  }
}

// Toast 提示条：顶部滑出，2秒自动消失
let toastTimer;
function showToast(msg) {
  const toast = document.querySelector('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);          // 连续提示时，重置计时器
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ============================================
// 渲染生词本卡片墙（状态驱动渲染）
// ============================================

function renderCards() {
  const wall = document.querySelector('#card-wall');

  // ⭐ 新增第一步：按当前标签过筛
  const list = currentFilter === 'all'
    ? vocabCards
    : vocabCards.filter(c => c.lang === currentFilter);

  // ⭐ 两种空态分开对待（产品细节：空库 ≠ 该语言没词）
  if (list.length === 0) {
    wall.innerHTML = vocabCards.length === 0
      ? '<p class="empty-tip">📭 生词本还是空的——查个单词，点收藏试试</p>'
      : '<p class="empty-tip">🈳 这个语言下还没有生词</p>';
    return;
  }

  wall.innerHTML = list.map(c => `
    <div class="card" data-word="${c.word}" data-lang="${c.lang}">
      <button class="delete-btn" title="删除">✕</button>
      <div class="card-inner">
        <div class="card-face card-front">
          <div class="card-word">${c.word}</div>
          <div class="card-ipa">${c.ipa || ''}</div>
          <div class="card-hint">🖱️ 悬停翻面</div>
        </div>
        <div class="card-face card-back">
          <div class="card-cn">${c.cn || '暂无释义'}</div>
          <div class="card-tip">🔊 点击发音</div>
        </div>
      </div>
    </div>
  `).join('');
}











// ============================================
// ============================================
// 事件绑定：下拉框切换 → 重新刷界面
// ============================================
// ============================================
langSelect.addEventListener('change', (e) => {
  currentLang = e.target.value;                        
  localStorage.setItem('preferred-lang', currentLang); 
  console.log(`📚 学习语言切换为：${LANGS[currentLang].name}`);

});

speakBtn.addEventListener('click', () => {
  const word = wordInput.value.trim();   // 读用户输入

  if (!word) {                            // 空输入检查
    resultBox.textContent = '⚠️ Please enter a word to pronounce.';
    return;                               // 函数到此为止，后面的不执行
  }

  speak(word);
});
// ============================================
// 事件绑定：查词按钮 → 查词 → 显示结果
// ============================================
searchBtn.addEventListener('click', async () => {
  const word = wordInput.value.trim();
  if (!word) {
    resultBox.textContent = '⚠️ 请先输入一个单词';
    currentCard = null;
    return;
  }

  resultBox.textContent = '⏳ 查询中...';
  const data = await lookupWord(word);
  if (!data || !data.entries || data.entries.length === 0) {
    resultBox.textContent = '❌ 没找到这个单词，换个试试？';
    currentCard = null; 
    return;
  }

  const entry = data.entries[0];
  const pos     = entry.partOfSpeech || '';
  const ipa     = entry.pronunciations?.[0]?.text || '';
  const def     = entry.senses?.[0]?.definition || '暂无释义';
  const example = entry.senses?.[0]?.examples?.[0] || '';
  const cnDef   = data.chineseDef;   // ← 新增：中文释义（可能是 null）


  // ⭐ 修复2：先打包、先算按钮 —— 必须在 innerHTML 之前
  currentCard = { word, lang: currentLang, ipa, cn: cnDef, addedAt: Date.now() };

  const alreadyIn = vocabCards.some(c => c.word === word && c.lang === currentLang);
  const btnHtml = alreadyIn
  ? `<button class="collect-btn" disabled>✅ 已在生词本</button>`
  : `<button class="collect-btn">➕ 收藏到生词本</button>`;

  
  resultBox.innerHTML = `
    <div class="word-title">
      <strong>${word}</strong>
      ${ipa ? `<span class="ipa">/${ipa}/</span>` : ''}
      ${pos ? `<span class="pos">${pos}</span>` : ''}
    </div>
    <p class="definition">${def}</p>
    ${cnDef ? `<p class="cn-def">CN${cnDef}</p>` : ''}
    ${example ? `<p class="example"><em>💬${example}</em></p>` : ''}
    ${btnHtml}
  `;

});

// ⭐ 事件委托：动态生成的收藏按钮，靠冒泡 + e.target 认领
resultBox.addEventListener('click', (e) => {
  // e.target 不是收藏按钮 → 和我们无关，直接撤退
  if (!e.target.classList.contains('collect-btn')) return;
  if (e.target.disabled || !currentCard) return;

  // 决策2：查重（保险丝，正常时按钮状态已经拦住了）
  const exists = vocabCards.some(c => c.word === currentCard.word && c.lang === currentCard.lang);
  if (exists) { showToast('⚠️ 该词已在生词本'); return; }

  // 入库 + 持久化
  vocabCards.push(currentCard);
  localStorage.setItem('vocabCards', JSON.stringify(vocabCards));

  // 按钮变身（不用重新渲染整个结果）
  e.target.textContent = '✅ 已在生词本';
  e.target.disabled = true;
  showToast('✅ 已收藏到生词本');
  renderCards();   // ⭐ 新卡立刻上墙，不用刷新！

});

document.querySelector('#card-wall').addEventListener('click', (e) => {
  // ── 分诊台 ①：先查是不是删除按钮（最具体的意图，最先判断！）
  const delBtn = e.target.closest('.delete-btn');
  if (delBtn) {
    const card = delBtn.closest('.card');
    const idx = vocabCards.findIndex(c =>
      c.word === card.dataset.word && c.lang === card.dataset.lang
    );
    if (idx !== -1) {
      vocabCards.splice(idx, 1);                              // 切除这张卡
      localStorage.setItem('vocabCards', JSON.stringify(vocabCards));
      renderCards();                                          // 三步舞：重画
      showToast(`🗑️ 已删除「${card.dataset.word}」`);
    }
    return;   // ⭐ 立刻撤退！否则继续往下走就触发发音了
  }

  // ── 分诊台 ②：普通点击 → 发音（5b 的老逻辑原样保留）
  const card = e.target.closest('.card');
  if (!card) return;
  speak(card.dataset.word, LANGS[card.dataset.lang]?.speechLang);
});

document.querySelector('#lang-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;

  currentFilter = tab.dataset.lang;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  renderCards();
});




// ============================================
// ============================================
// 初始化：页面打开时执行一次
// ============================================
// ============================================
const savedLang = localStorage.getItem('preferred-lang');

// 防御性检查：存的语言必须是配置表里存在的
if (savedLang && LANGS[savedLang]) {
  currentLang = savedLang;
}

langSelect.value = currentLang;                    
console.log('✅ Initialization complete, current language:', currentLang);
renderCards();   // 启动时把 localStorage 里的卡画上墙


