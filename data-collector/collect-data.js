const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// 데이터 저장 폴더 생성
const dataDir = path.join(__dirname, 'data');
fs.ensureDirSync(dataDir);

// 캐시 폴더 생성
const cacheDir = path.join(dataDir, 'cache');
fs.ensureDirSync(cacheDir);

// 기본 URL
const BASE_URL = 'https://wol.jw.org';
const START_URL = 'https://wol.jw.org/ko/wol/lv/r8/lp-ko/0/20383';

// 사용자 에이전트 설정 (차단 방지)
const config = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
  }
};

// 요청 간 지연 시간 (밀리초) - 더 짧게 조정
const DELAY = 500;

// 병렬 처리 배치 크기
const BATCH_SIZE = 3;

// 지연 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 재시도 로직
async function fetchWithRetry(url, retries = 3) {
  try {
    return await axios.get(url, config);
  } catch (error) {
    if (retries <= 0) throw error;
    console.log(`재시도 중... (${url})`);
    await delay(DELAY * 2);
    return fetchWithRetry(url, retries - 1);
  }
}

// 캐시된 데이터 가져오기 또는 새로 요청하기
async function fetchWithCache(url, cacheKey) {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  
  // 캐시 확인
  if (fs.existsSync(cachePath)) {
    console.log(`캐시 사용: ${cacheKey}`);
    return { data: fs.readJSONSync(cachePath) };
  }
  
  // 캐시가 없으면 요청
  console.log(`요청: ${url}`);
  const response = await fetchWithRetry(url);
  
  // HTML 응답은 캐싱하지 않음
  if (typeof response.data === 'string') {
    return response;
  }
  
  // JSON 데이터는 캐싱
  fs.writeJSONSync(cachePath, response.data, { spaces: 2 });
  return response;
}

// 메인 함수
async function main() {
  try {
    console.log('데이터 수집 시작...');
    
    // 1. 파수대 연도 목록 수집 (캐싱 적용)
    let yearDataList = [];
    const yearsCachePath = path.join(cacheDir, 'years.json');
    
    if (fs.existsSync(yearsCachePath)) {
      console.log('캐시된 연도 목록 사용');
      yearDataList = fs.readJSONSync(yearsCachePath);
    } else {
      yearDataList = await collectYears();
      fs.writeJSONSync(yearsCachePath, yearDataList, { spaces: 2 });
    }
    
    // 연도 목록 저장
    fs.writeJSONSync(path.join(dataDir, 'years.json'), yearDataList, { spaces: 2 });
    console.log(`연도 목록: ${yearDataList.length}개 항목`);
    
    // 2. 이전 진행 상황 확인
    const progressFile = path.join(dataDir, 'progress.json');
    let lastProcessedIndex = 0;
    let allQuestions = [];
    
    if (fs.existsSync(progressFile)) {
      const progress = fs.readJSONSync(progressFile);
      if (progress.lastProcessedYearIndex) {
        lastProcessedIndex = progress.lastProcessedYearIndex;
        console.log(`이전 진행 상황에서 계속: 인덱스 ${lastProcessedIndex}부터`);
      }
    }
    
    // 이미 수집된 질문 데이터 로드
    const allQuestionsPath = path.join(dataDir, 'all-questions.json');
    if (fs.existsSync(allQuestionsPath)) {
      allQuestions = fs.readJSONSync(allQuestionsPath);
      console.log(`기존 질문 데이터 로드: ${allQuestions.length}개 항목`);
    }
    
    // 3. 남은 연도 처리 (여러 연도 병렬 처리)
    for (let i = lastProcessedIndex; i < yearDataList.length; i += BATCH_SIZE) {
      const batch = yearDataList.slice(i, i + BATCH_SIZE);
      console.log(`배치 처리 중: ${i}~${i + batch.length - 1} / ${yearDataList.length}`);
      
      try {
        // 배치 내 연도 병렬 처리
        const promises = batch.map((yearData, batchIndex) => 
          processYear(yearData, i + batchIndex, allQuestions)
        );
        
        const batchResults = await Promise.all(promises);
        
        // 각 연도의 질문을 전체 목록에 추가
        for (const yearQuestions of batchResults) {
          if (yearQuestions && yearQuestions.length > 0) {
            allQuestions.push(...yearQuestions);
          }
        }
        
        // 진행 상황 저장
        saveProgress(allQuestions.length, i + batch.length);
        
        // 데이터 중간 저장
        fs.writeJSONSync(path.join(dataDir, 'all-questions.json'), allQuestions, { spaces: 2 });
        console.log(`현재까지 수집된 질문: ${allQuestions.length}개 항목`);
      } catch (error) {
        console.error(`배치 처리 중 오류 (${i}~${i + batch.length - 1}):`, error);
        // 오류가 발생해도 다음 배치 계속 진행
      }
    }
    
    // 모든 질문 데이터 최종 저장
    fs.writeJSONSync(path.join(dataDir, 'all-questions.json'), allQuestions, { spaces: 2 });
    console.log(`모든 독자의 질문 저장 완료: ${allQuestions.length}개 항목`);
    
    console.log('데이터 수집 완료!');
  } catch (error) {
    console.error('데이터 수집 중 오류 발생:', error);
  }
}

// 진행 상황 저장
function saveProgress(count, lastProcessedYearIndex) {
  const progressFile = path.join(dataDir, 'progress.json');
  const progress = {
    count,
    lastProcessedYearIndex,
    timestamp: new Date().toISOString()
  };
  
  fs.writeJSONSync(progressFile, progress, { spaces: 2 });
}

// 연도 목록 수집 함수
async function collectYears() {
  try {
    console.log(`파수대 연도 목록 수집 시작... URL: ${START_URL}`);
    const response = await fetchWithRetry(START_URL);
    const $ = cheerio.load(response.data);
    
    const years = [];
    
    // 파수대 연도 목록 추출
    $('li.row.card[role="presentation"]').each((i, el) => {
      const yearText = $(el).find('.cardTitleBlock').text().trim();
      
      const match = yearText.match(/파수대—(\d{4})/);
      
      if (match && match[1]) {
        // href 속성 상위 a 태그에서 가져오기
        const href = $(el).find('a').attr('href');
        const url = href ? `${BASE_URL}${href}` : null;
        
        years.push({
          year: match[1],
          url: url
        });
        
        console.log(`연도 추출: ${match[1]}, URL: ${url}`);
      }
    });
    
    return years;
  } catch (error) {
    console.error(`⚠️ 연도 목록 수집 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${START_URL}`);
    return [];
  }
}

// 연도별 처리 함수 (별도 함수로 분리)
async function processYear(yearData, yearIndex, allQuestions) {
  try {
    const year = yearData.year;
    const yearPageUrl = yearData.url;
    
    if (!yearPageUrl) {
      console.log(`${year} 페이지 URL이 없습니다.`);
      return [];
    }
    
    console.log(`${year} 처리 중...`);
    
    // 캐시 확인
    const yearCachePath = path.join(cacheDir, `year-${year}.json`);
    if (fs.existsSync(yearCachePath)) {
      console.log(`${year} 캐시 사용`);
      const cachedQuestions = fs.readJSONSync(yearCachePath);
      return cachedQuestions;
    }
    
    const yearQuestions = [];
    
    // 2008년 기준으로 다른 처리
    const yearInt = parseInt(year);
    if (yearInt >= 2008) {
      // 연구용 탭으로 이동
      await delay(DELAY);
      const researchUrl = await getResearchEditionUrl(yearPageUrl);
      
      if (researchUrl) {
        // 연구용 월별 목록
        await delay(DELAY);
        const monthlyIssues = await getMonthlyIssues(researchUrl);
        
        // 월별 이슈 병렬 처리 (2개씩)
        for (let i = 0; i < monthlyIssues.length; i += 2) {
          const issueBatch = monthlyIssues.slice(i, i + 2);
          const issuePromises = issueBatch.map(issue => processIssue(year, issue));
          
          const issueResults = await Promise.all(issuePromises);
          
          // 질문 추가
          for (const questions of issueResults) {
            yearQuestions.push(...questions);
          }
        }
      }
    } else {
      // 2007년 이전: 15일호 이슈 목록
      await delay(DELAY);
      const issues = await get15thDayIssues(yearPageUrl);
      
      // 이슈 병렬 처리 (2개씩)
      for (let i = 0; i < issues.length; i += 2) {
        const issueBatch = issues.slice(i, i + 2);
        const issuePromises = issueBatch.map(issue => processIssue(year, issue));
        
        const issueResults = await Promise.all(issuePromises);
        
        // 질문 추가
        for (const questions of issueResults) {
          yearQuestions.push(...questions);
        }
      }
    }
    
    // 연도별 결과 캐싱
    fs.writeJSONSync(yearCachePath, yearQuestions, { spaces: 2 });
    console.log(`${year} 질문 수집 완료: ${yearQuestions.length}개 항목`);
    
    return yearQuestions;
  } catch (error) {
    console.error(`${yearData.year} 처리 중 오류:`, error);
    return [];
  }
}

// 이슈 처리 함수
async function processIssue(year, issue) {
  try {
    await delay(DELAY);
    console.log(`${year} ${issue.title} 처리 중...`);
    
    // 캐시 확인
    const issueKey = `issue-${year}-${issue.title.replace(/\s+/g, '-')}`;
    const issueCachePath = path.join(cacheDir, `${issueKey}.json`);
    
    if (fs.existsSync(issueCachePath)) {
      console.log(`${issueKey} 캐시 사용`);
      return fs.readJSONSync(issueCachePath);
    }
    
    // 기사 목록 가져오기
    const articles = await getArticles(issue.url);
    
    const questions = [];
    
    // 독자의 질문 찾기
    for (const article of articles) {
      if (article.title.includes('독자') && article.title.includes('질문')) {
        await delay(DELAY);
        console.log(`질문 발견: ${article.title}`);
        
        // 질문 내용 가져오기
        const questionData = await getQuestionContent(article.url);
        
        const questionItem = {
          year,
          issue: issue.title,
          title: article.title,
          url: article.url,
          question: questionData.question,
          answer: questionData.answer
        };
        
        questions.push(questionItem);
        
        // 질문 데이터 개별 저장
        const filename = `question-${year}-${issue.title.replace(/\s+/g, '-')}-${article.title.substring(0, 20).replace(/\s+/g, '-')}.json`;
        fs.writeJSONSync(
          path.join(dataDir, filename),
          questionItem,
          { spaces: 2 }
        );
      }
    }
    
    // 이슈별 결과 캐싱
    fs.writeJSONSync(issueCachePath, questions, { spaces: 2 });
    
    return questions;
  } catch (error) {
    console.error(`이슈 처리 중 오류 (${year} ${issue.title}):`, error);
    return [];
  }
}

// 2008년 이후: 연구용 탭 URL 가져오기
async function getResearchEditionUrl(yearPageUrl) {
  try {
    // 캐시 키 생성
    const cacheKey = `research-${yearPageUrl.split('/').pop()}`;
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      return fs.readJSONSync(cachePath);
    }
    
    const response = await fetchWithRetry(yearPageUrl);
    const $ = cheerio.load(response.data);
    
    let researchUrl = null;
    
    // 수정된 선택자
    $('li.row.card[role="presentation"]').each((i, el) => {
      const title = $(el).find('.cardTitleBlock').text().trim();
      
      if (title.includes('연구용')) {
        const href = $(el).find('a').attr('href');
        researchUrl = href ? `${BASE_URL}${href}` : null;
      }
    });
    
    // 캐시에 저장
    if (researchUrl) {
      fs.writeJSONSync(cachePath, researchUrl, { spaces: 2 });
    }
    
    return researchUrl;
  } catch (error) {
    console.error(`연구용 탭 URL 가져오기 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${yearPageUrl}`);
    return null;
  }
}

// 연구용 파수대 월별 이슈 가져오기
async function getMonthlyIssues(researchUrl) {
  try {
    // 캐시 키 생성
    const cacheKey = `monthly-${researchUrl.split('/').pop()}`;
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      return fs.readJSONSync(cachePath);
    }
    
    const response = await fetchWithRetry(researchUrl);
    const $ = cheerio.load(response.data);
    
    const issues = [];
    
    $('li.row.card[role="presentation"]').each((i, el) => {
      const title = $(el).find('.cardTitleBlock').text().trim();
      const href = $(el).find('a').attr('href');
      const url = href ? `${BASE_URL}${href}` : null;
      
      if (title && url) {
        issues.push({ title, url });
      }
    });
    
    // 캐시에 저장
    fs.writeJSONSync(cachePath, issues, { spaces: 2 });
    
    return issues;
  } catch (error) {
    console.error(`월별 이슈 가져오기 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${researchUrl}`);
    return [];
  }
}

// 2007년 이전: 15일호 파수대 목록 가져오기
async function get15thDayIssues(yearPageUrl) {
  try {
    // 캐시 키 생성
    const cacheKey = `15thday-${yearPageUrl.split('/').pop()}`;
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      return fs.readJSONSync(cachePath);
    }
    
    const response = await fetchWithRetry(yearPageUrl);
    const $ = cheerio.load(response.data);
    
    const issues = [];
    
    $('li.row.card[role="presentation"]').each((i, el) => {
      const title = $(el).find('.cardTitleBlock').text().trim();
      const href = $(el).find('a').attr('href');
      const url = href ? `${BASE_URL}${href}` : null;
      
      // 15일호만 수집
      if (title && url && title.includes('15일')) {
        issues.push({ title, url });
      }
    });
    
    // 캐시에 저장
    fs.writeJSONSync(cachePath, issues, { spaces: 2 });
    
    return issues;
  } catch (error) {
    console.error(`15일호 목록 가져오기 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${yearPageUrl}`);
    return [];
  }
}

// 기사 목록 가져오기
async function getArticles(issueUrl) {
  try {
    // 캐시 키 생성
    const cacheKey = `articles-${issueUrl.split('/').pop()}`;
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      return fs.readJSONSync(cachePath);
    }
    
    const response = await fetchWithRetry(issueUrl);
    const $ = cheerio.load(response.data);
    
    const articles = [];
    
    $('li.row.card[role="presentation"]').each((i, el) => {
      const title = $(el).find('.cardTitleBlock').text().trim();
      const href = $(el).find('a').attr('href');
      const url = href ? `${BASE_URL}${href}` : null;
      
      if (title && url) {
        articles.push({ title, url });
      }
    });
    
    // 캐시에 저장
    fs.writeJSONSync(cachePath, articles, { spaces: 2 });
    
    return articles;
  } catch (error) {
    console.error(`기사 목록 가져오기 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${issueUrl}`);
    return [];
  }
}

// 독자의 질문 내용 가져오기
async function getQuestionContent(articleUrl) {
  try {
    // 캐시 키 생성
    const cacheKey = `question-${articleUrl.split('/').pop()}`;
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    if (fs.existsSync(cachePath)) {
      return fs.readJSONSync(cachePath);
    }
    
    const response = await fetchWithRetry(articleUrl);
    const $ = cheerio.load(response.data);
    
    // 질문과 답변 추출
    let question = '';
    let answer = '';
    
    // 제목 추출
    const title = $('.docSubtitle, .pubRefs').first().text().trim();
    
    // 첫 번째 단락이 질문
    $('.bodyTxt p').each((i, el) => {
      const text = $(el).text().trim();
      
      if (i === 0 || (i === 1 && !question.includes('?') && !question.includes('？'))) {
        question += ' ' + text;
      } else {
        answer += ' ' + text;
      }
    });
    
    const result = {
      title,
      question: question.trim(),
      answer: answer.trim()
    };
    
    // 캐시에 저장
    fs.writeJSONSync(cachePath, result, { spaces: 2 });
    
    return result;
  } catch (error) {
    console.error(`질문 내용 가져오기 실패: ${error.message}`);
    console.error(`실패한 요청 URL: ${articleUrl}`);
    return { title: '', question: '', answer: '' };
  }
}

// 스크립트 실행
main();