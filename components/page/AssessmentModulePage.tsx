import React from "react";
import EdittableTable from "@/components/table/EdittableTable";

type AssessmentModulePageProps = {
  currentPage: string;
};

const AssessmentModulePage = ({
  currentPage,
}: AssessmentModulePageProps) => {
  return <EdittableTable currentPage={currentPage} />;
};

export default AssessmentModulePage;