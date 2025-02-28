// src/components/QuestionItem.tsx
import React, { useState } from 'react';
import styled from 'styled-components';
import { Question } from '../types';

const QuestionCard = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  background-color: white;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const QuestionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
`;

const QuestionTitle = styled.h3`
  margin: 0;
  color: #4a76a8;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const QuestionMeta = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

const QuestionContent = styled.div`
  margin-top: 15px;
  line-height: 1.6;
`;

const ReadMoreButton = styled.button`
  background: none;
  border: none;
  color: #4a76a8;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  margin-top: 10px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const OriginalLink = styled.a`
  display: inline-block;
  margin-top: 15px;
  color: #4a76a8;
  text-decoration: none;
  font-size: 0.9rem;
  
  &:hover {
    text-decoration: underline;
  }
`;

interface QuestionItemProps {
  question: Question;
}

const QuestionItem: React.FC<QuestionItemProps> = ({ question }) => {
  const [expanded, setExpanded] = useState(false);
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  // 질문 내용 자르기 (미리보기용)
  const previewLength = 200;
  const hasLongQuestion = question.question.length > previewLength;
  const questionPreview = hasLongQuestion
    ? `${question.question.substring(0, previewLength)}...`
    : question.question;
  
  return (
    <QuestionCard>
      <QuestionHeader>
        <QuestionTitle onClick={toggleExpand}>{question.title}</QuestionTitle>
        <QuestionMeta>
          {question.year}년 {question.issue}
        </QuestionMeta>
      </QuestionHeader>
      
      <QuestionContent>
        <p><strong>요약:</strong> {expanded ? question.question : questionPreview}</p>
        {!expanded && hasLongQuestion && (
          <ReadMoreButton onClick={toggleExpand}>더 보기</ReadMoreButton>
        )}
      </QuestionContent>
      <OriginalLink href={question.url} target="_blank" rel="noopener noreferrer">
        원본 페이지 보기
      </OriginalLink>
    </QuestionCard>
  );
};

export default QuestionItem;