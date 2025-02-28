// src/components/YearFilter.tsx
import React from 'react';
import styled from 'styled-components';

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Label = styled.label`
  font-weight: bold;
`;

const Select = styled.select`
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1rem;
  min-width: 120px;
`;

interface YearFilterProps {
  years: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
}

const YearFilter: React.FC<YearFilterProps> = ({ years, selectedYear, onYearChange }) => {
  return (
    <FilterContainer>
      <Label htmlFor="year-filter">연도:</Label>
      <Select
        id="year-filter"
        value={selectedYear}
        onChange={(e) => onYearChange(e.target.value)}
      >
        <option value="all">전체 연도</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}년
          </option>
        ))}
      </Select>
    </FilterContainer>
  );
};

export default YearFilter;