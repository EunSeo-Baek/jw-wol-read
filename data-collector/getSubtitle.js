const fs = require("fs").promises;
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

// 병렬 처리 설정
const BATCH_SIZE = 10; // 동시에 처리할 요청 수
const DELAY_MS = 200; // 요청 간 지연 시간 (ms)

// 최신 사용자 에이전트 목록으로 업데이트 (더 현대적인 브라우저 버전)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
];

// Axios 요청 생성 함수 - 쿠키와 Referer 헤더 추가
function createAxiosRequest(url) {
  const randomAgent =
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  // Referer를 도메인 메인 페이지로 설정
  const urlObj = new URL(url);
  const referer = `${urlObj.protocol}//${urlObj.hostname}/`;

  return axios.get(url, {
    headers: {
      "User-Agent": randomAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: referer,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      DNT: "1",
    },
    timeout: 15000, // 15초 타임아웃 설정
    withCredentials: true, // 쿠키 전송 활성화
  });
}

// 지연 함수 - 랜덤 지연 추가
const delay = (ms) =>
  new Promise((resolve) => {
    const randomDelay = ms + Math.floor(Math.random() * 500); // 0-500ms 추가 랜덤 지연
    setTimeout(resolve, randomDelay);
  });

// 재시도 로직이 포함된 제목 추출 함수
async function extractSubtitleFromUrl(url, retries = 3) {
  try {
    console.log(`요청 중: ${url}`);
    const response = await createAxiosRequest(url);
    const $ = cheerio.load(response.data);

    // 수정된 선택자: article#article 내부의 .sn 클래스 요소에서 텍스트 추출
    const subtitle = $("article#article .sn").first().text().trim();

    if (!subtitle) {
      // 대체 선택자 시도 (다른 구조의 페이지를 위해)
      const altSubtitle = $("article#article strong").first().text().trim();
      if (altSubtitle) {
        console.log(`대체 선택자로 제목 찾음: ${url}`);
        return altSubtitle;
      }
      console.log(`제목을 찾을 수 없음: ${url}`);
    }

    return subtitle;
  } catch (error) {
    if (retries > 0) {
      console.log(`재시도 중... (${url}) - 남은 시도: ${retries}`);
      await delay(2000 * (4 - retries)); // 재시도할수록 더 긴 지연
      return extractSubtitleFromUrl(url, retries - 1);
    }
    console.error(`Error fetching subtitle for ${url}:`, error.message);
    return "";
  }
}

// 배치 처리 함수
async function processBatch(questions, startIndex, endIndex, totalQuestions) {
  const batch = questions.slice(startIndex, endIndex);
  const promises = batch.map(async (question, idx) => {
    const actualIndex = startIndex + idx;

    try {
      const subtitle = await extractSubtitleFromUrl(question.url);

      if (subtitle) {
        questions[actualIndex].subtitle = subtitle;
        console.log(
          `[${actualIndex + 1}/${totalQuestions}] Updated: ${
            question.url
          } -> ${subtitle}`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error processing ${question.url}:`, error);
      return false;
    } finally {
      // 각 요청 사이에 짧은 지연
      await delay(DELAY_MS);
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter((r) => r.status === "fulfilled" && r.value === true)
    .length; // 성공한 업데이트 수
}

async function updateQuestionsWithSubtitles() {
  try {
    // JSON 파일 읽기
    const jsonPath = path.join(__dirname, "/data/all-questions.json");
    const rawData = await fs.readFile(jsonPath, "utf8");
    let questions = JSON.parse(rawData);

    // 진행 상황 추적
    let updatedCount = 0;
    const totalQuestions = questions.length;
    console.log(`총 ${totalQuestions}개 항목 처리 시작`);

    // 중간 저장 기능
    const saveProgress = async () => {
      await fs.writeFile(jsonPath, JSON.stringify(questions, null, 2), "utf8");
      console.log(`[중간 저장] ${updatedCount}개 subtitle 업데이트 저장됨`);
    };

    // 시작 인덱스 (이어서 진행할 경우 조정)
    const startIndex = 68;

    // 배치 단위로 처리
    for (let i = startIndex; i < questions.length; i += BATCH_SIZE) {
      const endIndex = Math.min(i + BATCH_SIZE, questions.length);
      console.log(`배치 처리 중: ${i} ~ ${endIndex - 1}`);

      const batchUpdated = await processBatch(
        questions,
        i,
        endIndex,
        totalQuestions
      );
      updatedCount += batchUpdated;

      // 5개 배치마다 중간 저장
      if ((i - startIndex) % (BATCH_SIZE * 5) === 0 && i > startIndex) {
        await saveProgress();
      }

      // 배치 사이 랜덤 지연 (1-3초)
      const batchDelay = 1000 + Math.floor(Math.random() * 2000);
      console.log(`다음 배치까지 ${batchDelay}ms 대기 중...`);
      await delay(batchDelay);
    }

    // 최종 결과 저장
    await fs.writeFile(jsonPath, JSON.stringify(questions, null, 2), "utf8");

    console.log(
      `\n총 ${totalQuestions}개 중 ${updatedCount}개 subtitle 업데이트 완료`
    );
  } catch (error) {
    console.error("전체 프로세스 중 오류:", error);
  }
}

// 오류 처리 및 스크립트 실행
updateQuestionsWithSubtitles()
  .then(() => console.log("작업 완료"))
  .catch((err) => console.error("치명적 오류:", err));
