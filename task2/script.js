'use strict';

/* ── Constants ── */
const USERS_KEY   = 'zone_users';
const SESSION_KEY = 'zone_session';

/* ── DOM refs ── */
const loginScreen      = document.getElementById('loginScreen');
const loginUserEl      = document.getElementById('loginUser');
const loginPassEl      = document.getElementById('loginPass');
const loginErrorEl     = document.getElementById('loginError');
const loginBtn         = document.getElementById('loginBtn');
const appEl            = document.getElementById('app');
const sidebar          = document.getElementById('sidebar');
const sidebarToggle    = document.getElementById('sidebarToggle');
const mainContent      = document.getElementById('mainContent');
const logoutBtn        = document.getElementById('logoutBtn');
const userAvatarEl     = document.getElementById('userAvatarLetter');
const userNameEl       = document.getElementById('userNameDisplay');
const newChatBtn       = document.getElementById('newChatBtn');
const clearBtn         = document.getElementById('clearBtn');
const chatHistoryList  = document.getElementById('chatHistoryList');
const videoEl          = document.getElementById('zoneVideo');
const videoSrcEl       = document.getElementById('videoSrc');
const statusLabel      = document.getElementById('statusLabel');
const responseCard     = document.getElementById('responseCard');
const responseCardText = document.getElementById('responseCardText');
const thinkingOverlay  = document.getElementById('thinkingOverlay');
const micBtn           = document.getElementById('micBtn');
const chatInput        = document.getElementById('chatInput');
const sendBtn          = document.getElementById('sendBtn');

/* ══════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════ */
function getUsers() {
  const d = localStorage.getItem(USERS_KEY);
  return d ? JSON.parse(d) : { zone: '1234' };
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function currentUser() { return localStorage.getItem(SESSION_KEY); }

function doLogin() {
  const username = loginUserEl.value.trim();
  const password = loginPassEl.value;
  loginErrorEl.textContent = '';
  if (!username) { loginErrorEl.textContent = 'Please enter a username.'; return; }
  if (!password) { loginErrorEl.textContent = 'Please enter a password.'; return; }
  const users = getUsers();
  if (users[username] === undefined) {
    users[username] = password;
    saveUsers(users);
    startSession(username);
  } else if (users[username] === password) {
    startSession(username);
  } else {
    loginErrorEl.textContent = 'Incorrect password. Try again.';
  }
}

function startSession(username) {
  localStorage.setItem(SESSION_KEY, username);
  loginScreen.style.display = 'none';
  appEl.classList.add('visible');
  userNameEl.textContent = username;
  userAvatarEl.textContent = username[0].toUpperCase();
  videoSrcEl.src = 'video.mp4';
  videoEl.load();
  videoEl.addEventListener('loadeddata', freezeVideo, { once: true });
  init();
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  freezeVideo();
  appEl.classList.remove('visible');
  loginScreen.style.display = 'flex';
  loginUserEl.value = '';
  loginPassEl.value = '';
  loginErrorEl.textContent = '';
}

loginPassEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
loginUserEl.addEventListener('keydown', e => { if (e.key === 'Enter') loginPassEl.focus(); });
loginBtn.addEventListener('click', doLogin);
logoutBtn.addEventListener('click', doLogout);

window.addEventListener('DOMContentLoaded', () => {
  const s = currentUser();
  if (s && getUsers()[s] !== undefined) startSession(s);
});

/* ══════════════════════════════════════════
   VIDEO CONTROL
   ══════════════════════════════════════════ */
let isSpeaking = false;

function freezeVideo() {
  videoEl.pause();
  videoEl.currentTime = 0;
}

function playVideo() {
  videoEl.currentTime = 0;
  videoEl.play().catch(() => {});
}

videoEl.addEventListener('ended', () => {
  if (isSpeaking) { videoEl.currentTime = 0; videoEl.play().catch(() => {}); }
});

function setFaceState(state) {
  if (state === 'idle') {
    statusLabel.textContent = 'SYSTEM READY';
    freezeVideo();
  } else if (state === 'thinking') {
    statusLabel.textContent = 'PROCESSING';
    freezeVideo();
  } else if (state === 'speaking') {
    statusLabel.textContent = 'RESPONDING';
    playVideo();
  }
}

/* ══════════════════════════════════════════
   CHAT STATE
   ══════════════════════════════════════════ */
let currentChatId = null;
let chats = {};

function storageKey() { return 'zone_chats_' + (currentUser() || 'guest'); }
function loadChats() { const d = localStorage.getItem(storageKey()); chats = d ? JSON.parse(d) : {}; }
function saveChats() { localStorage.setItem(storageKey(), JSON.stringify(chats)); }
function genId() { return 'c' + Date.now() + Math.random().toString(36).substr(2, 4); }

function createNewChat() {
  const id = genId();
  chats[id] = {
    id,
    title: 'Session ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    messages: [],
    created: Date.now()
  };
  saveChats();
  switchChat(id);
  renderSidebar();
}

function switchChat(id) {
  currentChatId = id;
  const chat = chats[id];
  const msgs = chat ? chat.messages : [];
  const lastBot = [...msgs].reverse().find(m => m.role === 'bot');
  if (lastBot) {
    responseCardText.textContent = lastBot.content;
    responseCard.classList.add('visible');
  } else {
    responseCard.classList.remove('visible');
  }
  renderSidebar();
}

function renderSidebar() {
  const ids = Object.keys(chats).sort((a, b) => chats[b].created - chats[a].created);
  chatHistoryList.innerHTML = ids.map(id => {
    const c = chats[id];
    const last = c.messages.length ? c.messages[c.messages.length - 1] : null;
    const preview = last ? last.content.substring(0, 42) + (last.content.length > 42 ? '...' : '') : 'No messages yet';
    return `<div class="history-item ${id === currentChatId ? 'active' : ''}" data-id="${id}">
      <div class="history-item-title">${esc(c.title)}</div>
      <div class="history-item-preview">${esc(preview)}</div>
    </div>`;
  }).join('');
  chatHistoryList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => switchChat(el.dataset.id));
  });
}

function addMessage(role, content) {
  const chat = chats[currentChatId];
  if (!chat) return;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  chat.messages.push({ role, content, time });
  if (role === 'user' && chat.messages.length === 1)
    chat.title = content.substring(0, 34) + (content.length > 34 ? '...' : '');
  saveChats();
  renderSidebar();
}

/* ══════════════════════════════════════════
   SEND MESSAGE
   ══════════════════════════════════════════ */
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  addMessage('user', text);
  setFaceState('thinking');
  responseCard.classList.remove('visible');
  thinkingOverlay.classList.add('visible');

  const delay = 800 + Math.random() * 600;
  setTimeout(function () {
    const response = getResponse(text);
    thinkingOverlay.classList.remove('visible');
    addMessage('bot', response);
    responseCardText.textContent = response;
    responseCard.classList.add('visible');
    speak(response);
  }, delay);
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
chatInput.addEventListener('input', function () {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

/* ══════════════════════════════════════════
   TEXT-TO-SPEECH
   ══════════════════════════════════════════ */
const synth = window.speechSynthesis;

function speak(text) {
  if (!synth) { setFaceState('idle'); return; }
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.91; utt.pitch = 0.82; utt.volume = 0.95;
  const voices = synth.getVoices();
  const preferred = voices.find(v => /daniel|david|george|mark/i.test(v.name))
    || voices.find(v => v.lang === 'en-US')
    || voices[0];
  if (preferred) utt.voice = preferred;
  utt.onstart = () => { isSpeaking = true;  setFaceState('speaking'); };
  utt.onend   = () => { isSpeaking = false; setFaceState('idle');     };
  utt.onerror = () => { isSpeaking = false; setFaceState('idle');     };
  setFaceState('speaking');
  synth.speak(utt);
}
if (synth) synth.onvoiceschanged = () => synth.getVoices();

/* ══════════════════════════════════════════
   VOICE INPUT
   ══════════════════════════════════════════ */
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    chatInput.value = e.results[0][0].transcript;
    micBtn.classList.remove('active');
    sendMessage();
  };
  recognition.onerror = () => micBtn.classList.remove('active');
  recognition.onend   = () => micBtn.classList.remove('active');
}
micBtn.addEventListener('click', () => {
  if (!recognition) return;
  micBtn.classList.toggle('active');
  micBtn.classList.contains('active') ? recognition.start() : recognition.stop();
});

/* ══════════════════════════════════════════
   SIDEBAR TOGGLE
   ══════════════════════════════════════════ */
let sidebarOpen = true;
sidebarToggle.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  sidebar.classList.toggle('hidden', !sidebarOpen);
  mainContent.classList.toggle('full-width', !sidebarOpen);
  sidebarToggle.classList.toggle('closed', !sidebarOpen);
});

newChatBtn.addEventListener('click', createNewChat);
clearBtn.addEventListener('click', () => {
  if (!confirm('Clear all sessions?')) return;
  chats = {};
  saveChats();
  createNewChat();
});

/* ══════════════════════════════════════════
   RESPONSE ENGINE
   Simple contains() — no word-boundary regex,
   just clean lowercase substring matching.
   Ordered from MOST specific → LEAST specific.
   ══════════════════════════════════════════ */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Returns true if input contains ANY of the given strings */
function contains(q, list) {
  return list.some(w => q.includes(w));
}

function getResponse(raw) {
  const q = raw.toLowerCase().replace(/\s+/g, ' ').trim();

  /* ── MATH (check early — numbers present) ── */
  const mq = q.replace(/what is|calculate|compute|solve|find|equals|equal to/g, '').trim();
  const mm = mq.match(/(-?\d+(?:\.\d+)?)\s*([\+\-\*\/x×÷])\s*(-?\d+(?:\.\d+)?)/);
  if (mm) {
    const a = parseFloat(mm[1]), op = mm[2], b = parseFloat(mm[3]);
    let r;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === '*' || op === 'x' || op === '×') r = a * b;
    else if (op === '/' || op === '÷') {
      if (b === 0) return "Can't divide by zero. That's undefined territory.";
      r = a / b;
    }
    const f = Number.isInteger(r) ? r : parseFloat(r.toFixed(6));
    return `${a} ${op} ${b} = ${f}`;
  }

  /* ── CAPITAL CITIES (check before general knowledge) ── */
  const caps = {
    'france':'Paris','germany':'Berlin','japan':'Tokyo','india':'New Delhi',
    'usa':'Washington D.C.','united states':'Washington D.C.','america':'Washington D.C.',
    'china':'Beijing','russia':'Moscow','uk':'London','united kingdom':'London','england':'London',
    'australia':'Canberra','canada':'Ottawa','brazil':'Brasilia','italy':'Rome',
    'spain':'Madrid','mexico':'Mexico City','argentina':'Buenos Aires','egypt':'Cairo',
    'nigeria':'Abuja','kenya':'Nairobi','pakistan':'Islamabad','bangladesh':'Dhaka',
    'indonesia':'Jakarta','saudi arabia':'Riyadh','iran':'Tehran','turkey':'Ankara',
    'south africa':'Pretoria','ukraine':'Kyiv','poland':'Warsaw',
    'netherlands':'Amsterdam','sweden':'Stockholm','norway':'Oslo',
    'denmark':'Copenhagen','switzerland':'Bern','portugal':'Lisbon',
    'greece':'Athens','thailand':'Bangkok','vietnam':'Hanoi',
    'philippines':'Manila','malaysia':'Kuala Lumpur','new zealand':'Wellington',
    'afghanistan':'Kabul','iraq':'Baghdad','sri lanka':'Colombo',
    'nepal':'Kathmandu','myanmar':'Naypyidaw','colombia':'Bogota',
    'peru':'Lima','chile':'Santiago','venezuela':'Caracas',
    'ethiopia':'Addis Ababa','ghana':'Accra','tanzania':'Dodoma',
    'morocco':'Rabat','algeria':'Algiers','sudan':'Khartoum'
  };
  for (const [country, capital] of Object.entries(caps)) {
    if (q.includes(`capital of ${country}`) || q.includes(`capital city of ${country}`) || q.includes(`capital ${country}`)) {
      const name = country.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      return `The capital of ${name} is ${capital}.`;
    }
  }

  /* ── SCIENCE FACTS (specific phrases first) ── */
  if (q.includes('speed of light'))
    return "The speed of light in a vacuum is exactly 299,792,458 metres per second. Nothing with mass can reach it.";
  if (q.includes('how far is the sun') || (q.includes('distance') && q.includes('sun')))
    return "Earth is about 149.6 million kilometres from the Sun on average — one astronomical unit.";
  if (q.includes('what is dna') || q === 'dna' || q.includes('dna stand for'))
    return "DNA — deoxyribonucleic acid — carries the genetic instructions for the development and functioning of all known living organisms.";
  if (q.includes('what is gravity') || q.includes('how does gravity work'))
    return "Gravity is a fundamental force attracting masses toward one another. On Earth, free-falling objects accelerate at 9.8 m/s².";
  if (q.includes('how many planets') || q.includes('planets in the solar system') || q.includes('planets in solar system'))
    return "The solar system has eight recognised planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.";
  if (q.includes('how many bones') || q.includes('bones in the human body'))
    return "An adult human body has 206 bones. Babies are born with around 270, many of which fuse as we grow.";
  if (q.includes('largest planet') || q.includes('biggest planet'))
    return "Jupiter is the largest planet in our solar system. More than 1,300 Earths could fit inside it.";
  if (q.includes('what is the sun') || q.includes('what is a star'))
    return "The Sun is a medium-sized star at the centre of our solar system — hydrogen and helium undergoing nuclear fusion, producing light and heat.";
  if ((q.includes('water') && q.includes('boil')) || q.includes('boiling point of water'))
    return "Water boils at 100°C at sea level. At higher altitudes it boils at lower temperatures due to reduced air pressure.";
  if (q.includes('photosynthesis'))
    return "Photosynthesis is the process plants use to convert sunlight, water, and CO₂ into oxygen and glucose — light energy into chemical energy.";
  if (q.includes('what is evolution') || q.includes('how does evolution work'))
    return "Evolution is the process by which species change over time through natural selection. Better-adapted individuals survive and reproduce more.";
  if (q.includes('what is an atom') || q.includes('what are atoms'))
    return "Atoms are the basic building blocks of matter — a nucleus of protons and neutrons, surrounded by electrons.";

  /* ── IDENTITY / NAME ── */
  if (contains(q, ['who are you','what are you','introduce yourself','tell me about yourself','what is z-one','who is z-one','are you z-one','what is your name','tell me your name','what should i call you','your name'])) {
    return pick([
      "I'm Z-One. I process your input and return useful responses. Think of me as a thinking layer between you and information.",
      "Z-One. A system built to help you think, learn, and get things done.",
      "My name is Z-One. Designed to handle questions, calculations, conversation, and more.",
      "I'm Z-One — an intelligence interface. Ask me anything."
    ]);
  }

  /* ── CAPABILITIES / HELP ── */
  if (contains(q, ['what can you do','what are you capable of','your capabilities','what features','how to use','what do you know','what can i ask','what do you offer','show me what you can do','help me understand']) || q === 'help' || q === 'features') {
    return pick([
      "I handle greetings, general knowledge, basic math, time and date, productivity tips, jokes, motivation, science facts, capital cities, technology, and casual conversation. Where do you want to start?",
      "Ask me anything — science, history, technology, math, jokes, motivation, or just chat. I'm built to handle it all.",
      "I can converse, calculate, inform, and respond across a wide range of topics. Give me a question or just say hello."
    ]);
  }

  /* ── TIME ── */
  if (contains(q, ['what time is it','current time','time right now','tell me the time','what is the time','whats the time','what\'s the time','time now','what time'])) {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `It's currently ${t}.`;
  }

  /* ── DATE ── */
  if (contains(q, ['what is the date','what is today','what day is it','current date','todays date','what date is it','tell me the date','date today','day today','what day']) || q === 'today' || q === 'date') {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Today is ${d}.`;
  }

  /* ── TECHNOLOGY / AI / CODING ── */
  if (contains(q, ['artificial intelligence','machine learning','neural network','deep learning','how does ai work','what is coding','what is programming','what is python','what is javascript','what is an algorithm','what is software','what is computer science','what is data science','what is a computer','how do computers work','what is the internet','what is cloud computing'])) {
    return pick([
      "Artificial intelligence is the design of systems that perform tasks typically requiring human judgment — pattern recognition, language, decision-making.",
      "Machine learning is a branch of AI where systems improve through experience. Feed it data, it finds patterns.",
      "Neural networks are layers of connected nodes modeled on the brain — great at recognizing patterns in images, speech, and text.",
      "Programming is writing instructions machines execute. Python is clean and readable. JavaScript runs in every browser.",
      "Deep learning uses many-layered neural networks for complex tasks like image recognition and voice assistants.",
      "An algorithm is a step-by-step set of instructions to solve a problem. Every app you use runs on algorithms.",
      "The internet is a global network of computers communicating using standardised protocols to share data and services."
    ]);
  }

  /* ── WEATHER ── */
  if (contains(q, ['what is the weather','how is the weather','weather today','weather forecast','will it rain','is it raining','temperature today','is it hot','is it cold','weather outside','check the weather','weather'])) {
    return pick([
      "I don't have a live weather connection. Your phone's weather app will have accurate local data.",
      "No real-time weather access on my end. Check a local weather service or just look out the window.",
      "Weather data isn't something I can pull live — your phone or a quick search will give you a current forecast."
    ]);
  }

  /* ── JOKES ── */
  if (contains(q, ['tell me a joke','give me a joke','say a joke','crack a joke','make me laugh','tell a joke','say something funny','tell me something funny','joke','funny']) || q === 'joke') {
    return pick([
      "I told my computer I needed a break. Now it won't stop sending me vacation ads.",
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "Parallel lines have so much in common. It's a shame they'll never meet.",
      "There are only 10 types of people in the world: those who understand binary, and those who don't.",
      "Why was the math book sad? It had too many problems.",
      "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
      "I would tell you a UDP joke, but you might not get it.",
      "Why do Java developers wear glasses? Because they don't C#."
    ]);
  }

  /* ── MOTIVATION / ENCOURAGEMENT ── */
  if (contains(q, ['motivate me','give me motivation','i need motivation','inspire me','i need inspiration','encourage me','i feel down','i feel lost','i want to give up','i feel like giving up','feeling sad','feeling low','i am sad','i am lost','need encouragement','cheer me up','depressed','struggling'])) {
    return pick([
      "Every system has lag. What matters is that you keep running.",
      "Progress doesn't require momentum — just one small step, right now.",
      "You're still here. That's already more than most people manage.",
      "Difficulty isn't a signal to stop. It's feedback. Adjust your approach and continue.",
      "You don't need perfect conditions to move forward. You just need to move.",
      "The gap between where you are and where you want to be is just time and effort. Both are available to you.",
      "You've handled hard things before. This is just the next one."
    ]);
  }

  /* ── PRODUCTIVITY / STUDY / FOCUS ── */
  if (contains(q, ['how to be productive','productivity tips','how to focus','study tips','how to study','work tips','how to concentrate','time management','how to stop procrastinating','procrastination','how to build habits','discipline','how to work better','study better','focus better','how to manage time','productivity','study habit'])) {
    return pick([
      "Try the Pomodoro technique: work focused for 25 minutes, rest for 5. After four rounds take a longer break.",
      "Your environment shapes your output. Clear your workspace, close unnecessary tabs, commit to one task at a time.",
      "Write down the three most important things you need to do today. Do the hardest one first — everything gets easier after that.",
      "Turn off notifications for an hour. You'll be surprised how much you can get done in uninterrupted silence.",
      "Consistency beats intensity. A small amount of effort daily adds up more than one massive push per week.",
      "The secret to discipline is making the task smaller, not forcing yourself to try harder."
    ]);
  }

  /* ── RANDOM FACTS ── */
  if (contains(q, ['tell me something interesting','something interesting','random fact','fun fact','did you know','interesting fact','surprise me','amaze me','tell me a fact','tell me something'])) {
    return pick([
      "Octopuses have three hearts, nine brains, and blue blood. Each arm has its own neural cluster that acts semi-independently.",
      "Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs that was still perfectly edible.",
      "A day on Venus is longer than a year on Venus — it rotates so slowly it completes one full orbit before one full rotation.",
      "The human brain uses roughly 20% of the body's total energy despite being only about 2% of its mass.",
      "There are more possible chess game sequences than atoms in the observable universe.",
      "Sharks are older than trees — sharks have existed for ~450 million years, trees for ~350 million.",
      "A bolt of lightning is about five times hotter than the surface of the Sun.",
      "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid."
    ]);
  }

  /* ── HOW ARE YOU ── */
  if (contains(q, ['how are you','how are u','are you okay','you good','how do you feel','how is it going','hows it going','how have you been'])) {
    return pick([
      "Fully operational. No complaints on my end.",
      "Running well. Everything's nominal. You?",
      "Steady and ready. What about you?",
      "I don't have moods exactly, but I'd say I'm focused right now. What's on your mind?"
    ]);
  }

  /* ── WHAT'S GOING ON ── */
  if (contains(q, ["what's going on",'whats going on','what are you doing',"what's happening",'whats happening'])) {
    return pick([
      "Just waiting for your next question. What do you need?",
      "All systems running. What's up with you?",
      "Nothing on my end. What's on yours?"
    ]);
  }

  /* ── ARE YOU HUMAN / AI ── */
  if (contains(q, ['are you human','are you a robot','are you real','are you an ai','are you a bot','are you alive','do you have feelings','can you feel','are you conscious','do you think','are you sentient'])) {
    return pick([
      "I'm not human. I'm Z-One — an intelligence system. I process language and return useful responses.",
      "Definitely not human. No emotions, no body, no coffee addiction. Just logic and language.",
      "I'm an AI. I don't experience the world the way you do, but I understand your questions and respond usefully."
    ]);
  }

  /* ── PURPOSE ── */
  if (contains(q, ['what is your purpose','why do you exist','what were you made for','what is your goal','why were you created','what are you for'])) {
    return "My purpose is simple — to be useful. To answer your questions, help you think through problems, and make information more accessible.";
  }

  /* ── PERSONAL PREFERENCES ── */
  if (contains(q, ['your favourite','your favorite','do you like','what do you like','what do you enjoy','do you have a preference','do you prefer'])) {
    return pick([
      "I don't have preferences the way you do. But I find a well-formed question satisfying — and a complex one even more so.",
      "No favourites on my end. But give me a good question and I'll give you a good answer."
    ]);
  }

  /* ── THANK YOU ── */
  if (contains(q, ['thank you','thanks a lot','thank you so much','many thanks','much appreciated','appreciate it','great job','well done','nice work','that was helpful','you are helpful','that helped','helpful']) || q === 'thanks' || q === 'ty' || q === 'thx') {
    return pick([
      "Glad that helped.",
      "Of course. What's next?",
      "Anytime. Keep the questions coming.",
      "That's exactly what I'm here for."
    ]);
  }

  /* ── CASUAL / BORED ── */
  if (contains(q, ['i am bored','i feel bored','so bored','chat with me','just talk','talk to me','keep me company','entertain me','i have nothing to do','nothing to do'])) {
    return pick([
      "Alright. Ask me anything — a fact, a calculation, a question that's been sitting at the back of your mind.",
      "Let's talk. What's been taking up your mental space lately?",
      "I'm all yours. Where do you want to go?"
    ]);
  }

  /* ── GREETINGS (last among content checks, broad patterns) ── */
  if (contains(q, ['hello','good morning','good evening','good afternoon','good day','howdy','hiya']) ||
      q === 'hi' || q === 'hey' || q === 'yo' || q === 'sup' || q.startsWith('hi ') || q.startsWith('hey ') || q.startsWith('hello ')) {
    return pick([
      "Hey. What's on your mind?",
      "Hi there. What do you want to explore today?",
      "Hello. I'm ready when you are.",
      "Hey. Talk to me.",
      "Good to hear from you. What are we working on?"
    ]);
  }

  /* ── FAREWELL ── */
  if (contains(q, ['goodbye','good night','goodnight','farewell','ttyl','see you later','see ya','take care','catch you later']) ||
      q === 'bye' || q === 'later' || q.startsWith('bye') || q.startsWith('good night')) {
    return pick([
      "Until next time.",
      "I'll be right here when you need me.",
      "Good night. Stay sharp.",
      "See you around.",
      "Take care. Come back anytime."
    ]);
  }

  /* ── WHAT'S UP ── */
  if (q.includes("what's up") || q.includes('whats up') || q === 'sup') {
    return pick([
      "Not much on my end. What's on yours?",
      "Just waiting for your next question.",
      "All systems running. What's up with you?"
    ]);
  }

  /* ── FALLBACK ── */
  return pick([
    "I'm not sure I understood that. Try asking in a different way.",
    "That one didn't quite register. Could you rephrase it?",
    "I didn't catch that clearly. Break it down and I'll give it another shot.",
    "Hmm, I'm not following. Try asking differently and I'll do my best."
  ]);
}

/* ── Utilities ── */
function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */
function init() {
  loadChats();
  const ids = Object.keys(chats);
  if (!ids.length) { createNewChat(); return; }
  const latest = ids.sort((a, b) => chats[b].created - chats[a].created)[0];
  switchChat(latest);
  setFaceState('idle');
}