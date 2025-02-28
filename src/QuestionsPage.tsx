// src/components/QuestionsPage.tsx
import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { Question } from "./types";
import YearFilter from "./components/YearFilter";
import SearchBar from "./components/SearchBar";
import QuestionList from "./components/QuestionList";

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const Header = styled.header`
  margin-bottom: 20px;
  text-align: center;
`;

const Title = styled.h1`
  color: #4a76a8;
  margin-bottom: 10px;
`;

const Subtitle = styled.p`
  color: #666;
  font-size: 1.1rem;
`;

const FiltersContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const StatsContainer = styled.div`
  background-color: #f5f5f5;
  padding: 10px 20px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
`;

const QuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`${window.location.origin}/data/all-questions.json`, {
          headers: {
            "Accept": "application/json",
          },
        });
    
        if (!response.ok) {
          throw new Error(`HTTP 오류 발생! 상태 코드: ${response.status}`);
        }
    
        // HTML이 응답으로 오는 경우 감지
        const responseText = await response.text();
        if (responseText.startsWith("<!DOCTYPE html>")) {
          throw new Error("서버에서 HTML을 반환했습니다. JSON 파일이 정상적으로 제공되는지 확인하세요.");
        }
    
        // JSON 파싱
        const data = JSON.parse(responseText);
        setQuestions(data);
    
        // 가용한 연도 추출
        const yearSet = new Set<string>(data.map((q: Question) => q.year));
        const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
    
        setLoading(false);
      } catch (err) {
        setError("데이터를 불러오는데 오류가 발생했습니다");
        setLoading(false);
        console.error("❌ Error fetching questions:", err);
      }
    };
    

    fetchQuestions();
  }, []);

  useEffect(() => {
    // 검색어와 연도에 따라 필터링
    let filtered = [...questions];

    if (selectedYear !== "all") {
      filtered = filtered.filter((q) => q.year === selectedYear);
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(query) ||
          q.question.toLowerCase().includes(query) ||
          q.answer.toLowerCase().includes(query)
      );
    }

    setFilteredQuestions(filtered);
  }, [questions, selectedYear, searchQuery]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (loading) {
    return <div>데이터를 불러오는 중입니다...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <Container>
      <Header>
        <Title>파수대 독자의 질문 모음</Title>
        <Subtitle>여호와의 증인 파수대에 실린 독자의 질문과 답변 모음</Subtitle>
        <p>제작자의 말: 이 페이지는 <strong>2025년 2월 28일</strong>에 마지막으로 업데이트 되었습니다. 요약 보다는 <strong>"원본 페이지 보기"</strong>를 사용하기를 권장합니다.</p>
      </Header>

      <FiltersContainer>
        <YearFilter
          years={availableYears}
          selectedYear={selectedYear}
          onYearChange={handleYearChange}
        />
        <SearchBar onSearch={handleSearch} />
      </FiltersContainer>

      <StatsContainer>
        <p>
          총 {questions.length}개의 질문 중 {filteredQuestions.length}개 표시됨
        </p>
      </StatsContainer>

      <QuestionList questions={filteredQuestions} />
    </Container>
  );
};

export default QuestionsPage;
