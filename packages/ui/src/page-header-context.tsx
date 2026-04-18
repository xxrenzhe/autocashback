"use client";

import { createContext, useContext, type ReactNode } from "react";

type PageHeaderContextValue = {
  description?: ReactNode;
  title?: ReactNode;
};

const PageHeaderContext = createContext<PageHeaderContextValue>({});

export function PageHeaderProvider({
  children,
  value
}: {
  children: ReactNode;
  value: PageHeaderContextValue;
}) {
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderContext() {
  return useContext(PageHeaderContext);
}
