import React from 'react';
import { useTaxCaseStore } from './store';
import { Layout } from './components/Layout';
import {
  Step0ReportType,
  Step1Taxpayer,
  Step2Assets,
  Step3Stock,
  Step4Relief,
  Step5Penalty,
  Step6Result,
  Step7PDF,
} from './components/steps';
import './App.css';

function StepContent() {
  const { currentStep } = useTaxCaseStore();

  switch (currentStep) {
    case 0:
      return <Step0ReportType />;
    case 1:
      return <Step1Taxpayer />;
    case 2:
      return <Step2Assets />;
    case 3:
      return <Step3Stock />;
    case 4:
      return <Step4Relief />;
    case 5:
      return <Step5Penalty />;
    case 6:
      return <Step6Result />;
    case 7:
      return <Step7PDF />;
    default:
      return <Step0ReportType />;
  }
}

function App() {
  const { refreshCaseList } = useTaxCaseStore();

  React.useEffect(() => {
    refreshCaseList();
  }, []);

  return (
    <Layout>
      <StepContent />
    </Layout>
  );
}

export default App;
