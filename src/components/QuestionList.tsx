// src/components/QuestionList.tsx
import React from 'react';
import styled from 'styled-components';
import { Question } from '../types';
import QuestionItem from './QuestionItem';

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 40px;
  background-color: #f9f9f9;
  border-radius: 8px;
  font-size: 1.1rem;
  color: #666;
`;

interface QuestionListProps {
  questions: Question[];
}

const QuestionList: React.FC<QuestionListProps> = ({ questions }) => {
  if (questions.length === 0) {
    return <EmptyMessage>검색 결과가 없습니다.</EmptyMessage>;
  }

  return (
    <List>
      {questions.map((question, index) => (
        <QuestionItem key={index} question={question} />
      ))}
    </List>
  );
};

export default QuestionList;