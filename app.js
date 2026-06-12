(function () {
  const entries = [...window.GACHI_ENTRIES].sort((a, b) => a.rank - b.rank);
  const STORAGE_KEY = "gachi-vocab-state-v1";
  const REVIEW_INTERVALS = [0, 4, 24, 72, 168, 360, 720];
  const state = loadState();
  let selectedId = state.selectedId || entries[0].id;
  let activeFilter = state.activeFilter || "all";
  let activeMode = state.activeMode || "study";
  let quizDirection = state.quizDirection || "meaning-to-term";
  let quiz = null;
  let searchQuery = "";
  let toastTimer = 0;

  const els = {
    deckStatus: document.getElementById("deckStatus"),
    learnedCount: document.getElementById("learnedCount"),
    dueCount: document.getElementById("dueCount"),
    masteredCount: document.getElementById("masteredCount"),
    streakCount: document.getElementById("streakCount"),
    searchInput: document.getElementById("searchInput"),
    nextNewButton: document.getElementById("nextNewButton"),
    entryList: document.getElementById("entryList"),
    listMeta: document.getElementById("listMeta"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    previousButton: document.getElementById("previousButton"),
    nextButton: document.getElementById("nextButton"),
    rankPill: document.getElementById("rankPill"),
    studyModeButton: document.getElementById("studyModeButton"),
    quizModeButton: document.getElementById("quizModeButton"),
    studyCard: document.getElementById("studyCard"),
    kindLine: document.getElementById("kindLine"),
    termText: document.getElementById("termText"),
    ipaText: document.getElementById("ipaText"),
    meaningStrip: document.getElementById("meaningStrip"),
    coreText: document.getElementById("coreText"),
    usageList: document.getElementById("usageList"),
    examples: document.getElementById("examples"),
    chunkSection: document.getElementById("chunkSection"),
    chunkList: document.getElementById("chunkList"),
    reviewActions: document.getElementById("reviewActions"),
    againButton: document.getElementById("againButton"),
    goodButton: document.getElementById("goodButton"),
    masteredButton: document.getElementById("masteredButton"),
    quizPanel: document.getElementById("quizPanel"),
    quizKindLine: document.getElementById("quizKindLine"),
    quizPromptTitle: document.getElementById("quizPromptTitle"),
    meaningToTermButton: document.getElementById("meaningToTermButton"),
    termToMeaningButton: document.getElementById("termToMeaningButton"),
    exampleClozeButton: document.getElementById("exampleClozeButton"),
    quizMeta: document.getElementById("quizMeta"),
    quizQuestion: document.getElementById("quizQuestion"),
    quizOptions: document.getElementById("quizOptions"),
    quizFeedback: document.getElementById("quizFeedback"),
    nextQuizButton: document.getElementById("nextQuizButton"),
    speakButton: document.getElementById("speakButton"),
    cardSpeakButton: document.getElementById("cardSpeakButton"),
    exportButton: document.getElementById("exportButton"),
    importInput: document.getElementById("importInput"),
    toast: document.getElementById("toast"),
  };

  els.deckStatus.textContent = `${entries.length}語句・会話頻出順`;

  els.searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value.trim().toLowerCase();
    const visible = getVisibleEntries();
    if (visible.length && !visible.some((entry) => entry.id === selectedId)) {
      selectedId = visible[0].id;
      state.selectedId = selectedId;
      saveState();
    }
    if (activeMode === "quiz") quiz = null;
    render();
    scrollSelectedIntoView();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter;
      state.activeFilter = activeFilter;
      saveState();
      const visible = getVisibleEntries();
      if (visible.length && !visible.some((entry) => entry.id === selectedId)) {
        selectedId = visible[0].id;
        state.selectedId = selectedId;
        saveState();
      }
      if (activeMode === "quiz") quiz = null;
      render();
      scrollSelectedIntoView();
    });
  });

  els.entryList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item) return;
    selectedId = item.dataset.id;
    state.selectedId = selectedId;
    if (activeMode === "quiz") createQuizQuestion(selectedId);
    saveState();
    render();
  });

  els.previousButton.addEventListener("click", () => moveSelection(-1));
  els.nextButton.addEventListener("click", () => moveSelection(1));
  els.nextNewButton.addEventListener("click", selectNextStudyTarget);
  els.studyModeButton.addEventListener("click", () => setMode("study"));
  els.quizModeButton.addEventListener("click", () => setMode("quiz"));
  els.meaningToTermButton.addEventListener("click", () => setQuizDirection("meaning-to-term"));
  els.termToMeaningButton.addEventListener("click", () => setQuizDirection("term-to-meaning"));
  els.exampleClozeButton.addEventListener("click", () => setQuizDirection("example-cloze"));
  els.nextQuizButton.addEventListener("click", nextQuizQuestion);
  els.quizOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-choice-id]");
    if (!option) return;
    answerQuiz(option.dataset.choiceId);
  });
  els.againButton.addEventListener("click", () => gradeSelected("again"));
  els.goodButton.addEventListener("click", () => gradeSelected("good"));
  els.masteredButton.addEventListener("click", () => gradeSelected("mastered"));
  els.speakButton.addEventListener("click", speakSelected);
  els.cardSpeakButton.addEventListener("click", speakSelected);
  els.exportButton.addEventListener("click", exportProgress);
  els.importInput.addEventListener("change", importProgress);

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    if (activeMode === "quiz" && ["1", "2", "3", "4"].includes(event.key)) {
      const choiceId = quiz?.choiceIds[Number(event.key) - 1];
      if (choiceId) answerQuiz(choiceId);
      return;
    }
    if (activeMode === "quiz" && event.key === "Enter" && quiz?.answeredId) {
      nextQuizQuestion();
      return;
    }
    if (event.key === "ArrowLeft") moveSelection(-1);
    if (event.key === "ArrowRight") moveSelection(1);
    if (event.key === "1") gradeSelected("again");
    if (event.key === "2") gradeSelected("good");
    if (event.key === "3") gradeSelected("mastered");
    if (event.key.toLowerCase() === "p") speakSelected();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }

  render();
  scrollSelectedIntoView();

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && typeof parsed === "object") {
        return {
          progress: parsed.progress || {},
          selectedId: parsed.selectedId,
          activeFilter: parsed.activeFilter,
          activeMode: parsed.activeMode,
          quizDirection: parsed.quizDirection,
          streak: Number(parsed.streak || 0),
          lastStudyDate: parsed.lastStudyDate || "",
        };
      }
    } catch (error) {
      console.warn("Progress reset because saved data could not be read.", error);
    }
    return { progress: {}, streak: 0, lastStudyDate: "" };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function touchStreak() {
    const today = todayKey();
    if (state.lastStudyDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    state.streak = state.lastStudyDate === yesterdayKey ? Number(state.streak || 0) + 1 : 1;
    state.lastStudyDate = today;
  }

  function getProgress(id) {
    if (!state.progress[id]) {
      state.progress[id] = {
        box: 0,
        reviews: 0,
        nextDue: 0,
        mastered: false,
        lastGrade: "",
      };
    }
    return state.progress[id];
  }

  function isDue(entry) {
    const progress = getProgress(entry.id);
    return progress.reviews > 0 && !progress.mastered && progress.nextDue <= Date.now();
  }

  function getVisibleEntries() {
    return entries.filter((entry) => {
      const progress = getProgress(entry.id);
      const haystack = [
        entry.term,
        entry.ipa,
        entry.pos,
        entry.type,
        ...entry.meanings,
        entry.core,
        ...entry.usage,
        ...entry.examples.flat(),
        ...entry.chunks,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !searchQuery || haystack.includes(searchQuery);
      if (!matchesSearch) return false;
      if (activeFilter === "new") return progress.reviews === 0;
      if (activeFilter === "due") return isDue(entry);
      if (activeFilter === "mastered") return progress.mastered;
      if (activeFilter === "phrase") return entry.type === "phrase";
      return true;
    });
  }

  function render() {
    if (activeMode === "quiz") {
      if (!quiz || !entries.some((entry) => entry.id === quiz.entryId)) {
        createQuizQuestion(selectedId);
      } else {
        selectedId = quiz.entryId;
      }
    }
    const selected = entries.find((entry) => entry.id === selectedId) || entries[0];
    selectedId = selected.id;
    renderStats();
    renderTabs();
    renderMode();
    renderList();
    renderCard(selected);
    renderQuiz();
    state.selectedId = selectedId;
    saveState();
  }

  function renderStats() {
    const progressValues = entries.map((entry) => getProgress(entry.id));
    const learned = progressValues.filter((progress) => progress.reviews > 0).length;
    const due = entries.filter(isDue).length;
    const mastered = progressValues.filter((progress) => progress.mastered).length;
    els.learnedCount.textContent = learned;
    els.dueCount.textContent = due;
    els.masteredCount.textContent = mastered;
    els.streakCount.textContent = Number(state.streak || 0);
  }

  function renderTabs() {
    els.tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.filter === activeFilter);
    });
  }

  function renderMode() {
    const quizActive = activeMode === "quiz";
    els.studyModeButton.classList.toggle("is-active", !quizActive);
    els.quizModeButton.classList.toggle("is-active", quizActive);
    els.studyCard.hidden = quizActive;
    els.reviewActions.hidden = quizActive;
    els.quizPanel.hidden = !quizActive;
    els.meaningToTermButton.classList.toggle("is-active", quizDirection === "meaning-to-term");
    els.termToMeaningButton.classList.toggle("is-active", quizDirection === "term-to-meaning");
    els.exampleClozeButton.classList.toggle("is-active", quizDirection === "example-cloze");
  }

  function renderList() {
    const visible = getVisibleEntries();
    els.listMeta.textContent = `${visible.length}件`;
    els.entryList.replaceChildren(
      ...visible.map((entry) => {
        const progress = getProgress(entry.id);
        const li = document.createElement("li");
        const button = document.createElement("button");
        const dotClass = progress.mastered ? "is-mastered" : isDue(entry) ? "is-due" : "";
        button.className = `entry-item${entry.id === selectedId ? " is-selected" : ""}`;
        button.type = "button";
        button.dataset.id = entry.id;
        button.innerHTML = `
          <span class="entry-rank">#${entry.rank}</span>
          <span class="entry-main">
            <span class="entry-term"></span>
            <span class="entry-sub"></span>
          </span>
          <span class="status-dot ${dotClass}" aria-hidden="true"></span>
        `;
        button.querySelector(".entry-term").textContent = entry.term;
        button.querySelector(".entry-sub").textContent = `${entry.ipa}・${entry.meanings[0]}`;
        li.append(button);
        return li;
      }),
    );
  }

  function renderCard(entry) {
    const progress = getProgress(entry.id);
    els.rankPill.textContent = `#${entry.rank}`;
    els.kindLine.textContent = `${entry.type}・${entry.pos}`;
    els.termText.textContent = entry.term;
    els.ipaText.textContent = entry.ipa;
    els.meaningStrip.replaceChildren(
      ...entry.meanings.map((meaning) => {
        const chip = document.createElement("span");
        chip.className = "meaning-chip";
        chip.textContent = meaning;
        return chip;
      }),
    );
    els.coreText.textContent = entry.core;
    els.usageList.replaceChildren(
      ...entry.usage.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }),
    );
    els.examples.replaceChildren(
      ...entry.examples.map(([en, ja]) => {
        const block = document.createElement("div");
        block.className = "example";
        block.innerHTML = `
          <p class="example-en"></p>
          <p class="example-ja"></p>
        `;
        block.querySelector(".example-en").textContent = en;
        block.querySelector(".example-ja").textContent = ja;
        return block;
      }),
    );
    els.chunkSection.hidden = entry.chunks.length === 0;
    els.chunkList.replaceChildren(
      ...entry.chunks.map((chunk) => {
        const item = document.createElement("span");
        item.className = "chunk";
        item.textContent = chunk;
        return item;
      }),
    );
    els.masteredButton.querySelector("small").textContent = progress.mastered ? "定着済み" : "定着へ";
  }

  function renderQuiz() {
    if (activeMode !== "quiz") return;
    if (!quiz || !entries.some((entry) => entry.id === quiz.entryId)) {
      createQuizQuestion();
    }

    const entry = findEntry(quiz.entryId);
    if (!entry) return;
    const direction = quizDirection;
    els.quizKindLine.textContent = `${entry.type}・確認テスト`;
    els.quizPromptTitle.textContent = getQuizTitle(direction);
    els.quizMeta.textContent = `#${entry.rank}・${entry.type === "phrase" ? "熟語" : "単語"}`;
    els.quizQuestion.replaceChildren(buildQuizQuestion(entry, direction));
    els.quizOptions.replaceChildren(
      ...quiz.choiceIds.map((choiceId, index) => buildQuizOption(findEntry(choiceId), index, direction)),
    );
    renderQuizFeedback(entry);
  }

  function getQuizTitle(direction) {
    if (direction === "term-to-meaning") return "英語から意味を選ぶ";
    if (direction === "example-cloze") return "例文から英語を選ぶ";
    return "意味から英語を選ぶ";
  }

  function buildQuizQuestion(entry, direction) {
    const block = document.createElement("div");
    block.className = "quiz-focus";
    const title = document.createElement("strong");
    const detail = document.createElement("p");

    if (direction === "meaning-to-term") {
      title.textContent = entry.meanings.join(" / ");
      detail.textContent = entry.core;
    } else if (direction === "term-to-meaning") {
      title.textContent = entry.term;
      detail.textContent = `${entry.ipa}・${entry.examples[0][0]}`;
    } else {
      const example = getClozeExample(entry);
      title.className = "quiz-example";
      title.textContent = example.en;
      detail.textContent = `${example.ja}・${entry.core}`;
    }

    block.append(title, detail);
    return block;
  }

  function buildQuizOption(entry, index, direction) {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.type = "button";
    button.dataset.choiceId = entry.id;
    button.disabled = Boolean(quiz.answeredId);
    if (quiz.answeredId && entry.id === quiz.entryId) button.classList.add("is-correct");
    if (quiz.answeredId === entry.id && entry.id !== quiz.entryId) button.classList.add("is-wrong");

    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const showsTerm = direction === "meaning-to-term" || direction === "example-cloze";
    title.textContent = `${index + 1}. ${showsTerm ? entry.term : entry.meanings.join(" / ")}`;
    detail.textContent = showsTerm ? entry.ipa : entry.core;
    button.append(title, detail);
    return button;
  }

  function renderQuizFeedback(entry) {
    els.quizFeedback.replaceChildren();
    if (!quiz.answeredId) return;

    const title = document.createElement("strong");
    title.textContent = quiz.correct ? `正解: ${entry.term} ${entry.ipa}` : `正解は ${entry.term} ${entry.ipa}`;
    const core = document.createElement("p");
    core.textContent = entry.core;
    const example = document.createElement("p");
    example.textContent = `${entry.examples[0][0]} / ${entry.examples[0][1]}`;
    els.quizFeedback.append(title, core, example);
  }

  function getClozeExample(entry) {
    const candidates = getTermPatterns(entry);
    for (const [en, ja] of entry.examples) {
      for (const pattern of candidates) {
        const regex = new RegExp(`(^|\\b)${escapeRegExp(pattern)}(?=\\b|$)`, "i");
        if (regex.test(en)) {
          return {
            en: en.replace(regex, (match, prefix) => `${prefix}_____`),
            ja,
          };
        }
      }
    }

    const [en, ja] = entry.examples[0];
    return {
      en: `${en}  _____`,
      ja,
    };
  }

  function getTermPatterns(entry) {
    const terms = entry.term
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    return [...terms, entry.term].sort((a, b) => b.length - a.length);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function moveSelection(direction) {
    const visible = getVisibleEntries();
    if (!visible.length) return;
    const currentIndex = Math.max(
      0,
      visible.findIndex((entry) => entry.id === selectedId),
    );
    const nextIndex = (currentIndex + direction + visible.length) % visible.length;
    selectedId = visible[nextIndex].id;
    render();
    scrollSelectedIntoView();
  }

  function selectNextStudyTarget() {
    const dueEntry = entries.find(isDue);
    const newEntry = entries.find((entry) => getProgress(entry.id).reviews === 0);
    const target = dueEntry || newEntry || entries.find((entry) => !getProgress(entry.id).mastered) || entries[0];
    selectedId = target.id;
    activeFilter = dueEntry ? "due" : "all";
    render();
    showToast(dueEntry ? "復習カードへ移動しました" : "次の未学習カードへ移動しました");
    scrollSelectedIntoView();
  }

  function gradeSelected(grade) {
    const message = applyGrade(selectedId, grade);
    render();
    showToast(message);
    moveAfterGrade();
  }

  function applyGrade(entryId, grade) {
    const progress = getProgress(entryId);
    touchStreak();
    progress.reviews += 1;
    progress.lastReviewed = Date.now();
    progress.lastGrade = grade;
    progress.mastered = grade === "mastered";

    if (grade === "again") {
      progress.box = Math.max(1, Math.min(progress.box, 2));
    } else if (grade === "good") {
      progress.box = Math.min(6, Number(progress.box || 0) + 1);
    } else {
      progress.box = 6;
    }

    const hours = REVIEW_INTERVALS[progress.box] || REVIEW_INTERVALS.at(-1);
    progress.nextDue = Date.now() + hours * 60 * 60 * 1000;
    saveState();
    return (
      grade === "again"
        ? "短い間隔で復習に戻しました"
        : grade === "good"
          ? "復習間隔を延ばしました"
          : "定着に入れました"
    );
  }

  function moveAfterGrade() {
    const visible = getVisibleEntries();
    const currentIndex = visible.findIndex((entry) => entry.id === selectedId);
    if (currentIndex >= 0 && visible.length > 1) {
      selectedId = visible[(currentIndex + 1) % visible.length].id;
    } else {
      const next = entries.find(isDue) || entries.find((entry) => getProgress(entry.id).reviews === 0);
      if (next) selectedId = next.id;
    }
    render();
    scrollSelectedIntoView();
  }

  function scrollSelectedIntoView() {
    requestAnimationFrame(() => {
      const selected = els.entryList.querySelector(".is-selected");
      selected?.scrollIntoView({ block: "nearest" });
    });
  }

  function setMode(mode) {
    activeMode = mode;
    state.activeMode = mode;
    if (mode === "quiz" && !quiz) createQuizQuestion(selectedId);
    saveState();
    render();
    scrollSelectedIntoView();
  }

  function setQuizDirection(direction) {
    quizDirection = direction;
    state.quizDirection = direction;
    createQuizQuestion(selectedId);
    saveState();
    render();
  }

  function nextQuizQuestion() {
    createQuizQuestion();
    render();
    scrollSelectedIntoView();
  }

  function createQuizQuestion(preferredEntryId = "") {
    const pool = getQuizPool();
    const due = pool.filter(isDue);
    const fresh = pool.filter((entry) => getProgress(entry.id).reviews === 0);
    const targetPool = due.length ? due : fresh.length ? fresh : pool;
    let target = targetPool.find((entry) => entry.id === preferredEntryId) || sample(targetPool);
    if (!preferredEntryId && quiz && targetPool.length > 1) {
      const alternatives = targetPool.filter((entry) => entry.id !== quiz.entryId);
      target = sample(alternatives);
    }

    const distractors = shuffle(entries.filter((entry) => entry.id !== target.id)).slice(0, 3);
    quiz = {
      entryId: target.id,
      choiceIds: shuffle([target, ...distractors]).map((entry) => entry.id),
      answeredId: "",
      correct: false,
    };
    selectedId = target.id;
    state.selectedId = selectedId;
    saveState();
  }

  function getQuizPool() {
    const visible = getVisibleEntries();
    return visible.length ? visible : entries;
  }

  function answerQuiz(choiceId) {
    if (!quiz || quiz.answeredId) return;
    quiz.answeredId = choiceId;
    quiz.correct = choiceId === quiz.entryId;
    selectedId = quiz.entryId;
    state.selectedId = selectedId;
    const message = applyGrade(quiz.entryId, quiz.correct ? "good" : "again");
    render();
    showToast(quiz.correct ? `正解。${message}` : `惜しい。${message}`);
    scrollSelectedIntoView();
  }

  function findEntry(id) {
    return entries.find((entry) => entry.id === id);
  }

  function sample(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function shuffle(items) {
    const copied = [...items];
    for (let index = copied.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]];
    }
    return copied;
  }

  function speakSelected() {
    const entry = entries.find((item) => item.id === selectedId);
    if (!entry || !("speechSynthesis" in window)) {
      showToast("このブラウザでは音声読み上げを使えません");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.term.replace(/\s*\/\s*/g, " "));
    utterance.lang = "en-US";
    utterance.rate = entry.type === "phrase" ? 0.82 : 0.86;
    window.speechSynthesis.speak(utterance);
  }

  function exportProgress() {
    const payload = {
      app: "gachi-vocab",
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gachi-vocab-progress-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("進捗を書き出しました");
  }

  function importProgress(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = parsed.state || parsed;
        if (!imported.progress || typeof imported.progress !== "object") {
          throw new Error("Invalid progress file");
        }
        state.progress = imported.progress;
        state.selectedId = imported.selectedId || selectedId;
        state.activeFilter = imported.activeFilter || activeFilter;
        state.activeMode = imported.activeMode || activeMode;
        state.quizDirection = imported.quizDirection || quizDirection;
        state.streak = Number(imported.streak || 0);
        state.lastStudyDate = imported.lastStudyDate || "";
        selectedId = state.selectedId;
        activeFilter = state.activeFilter;
        activeMode = state.activeMode;
        quizDirection = state.quizDirection;
        quiz = null;
        saveState();
        render();
        showToast("進捗を読み込みました");
      } catch (error) {
        showToast("進捗ファイルを読み込めませんでした");
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2200);
  }
})();
