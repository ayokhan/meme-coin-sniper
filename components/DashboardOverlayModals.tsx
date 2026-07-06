"use client";

import DashboardPathPickerModal from "@/components/DashboardPathPickerModal";
import FuturesOnboardingModal from "@/components/FuturesOnboardingModal";
import { useDashboardOverlay } from "@/components/DashboardOverlayProvider";
import type { DashboardPathApplyOptions, DashboardPathApplyResult } from "@/lib/dashboard-onboarding";

type PathPickerProps = {
  open: boolean;
  pathOptions: DashboardPathApplyOptions;
  onClose: () => void;
  onApply: (result: DashboardPathApplyResult) => void;
};

export function DashboardPathPickerOverlay(props: PathPickerProps) {
  const open = useDashboardOverlay("path-picker", props.open);
  return <DashboardPathPickerModal {...props} open={open} />;
}

type FuturesProps = {
  activeTab: string;
  showPrompt: boolean;
  onClose: () => void;
  onGoNovaRadar?: () => void;
};

export function FuturesOnboardingOverlay({ activeTab, showPrompt, onClose, onGoNovaRadar }: FuturesProps) {
  const wantsOpen = activeTab === "futures" && showPrompt;
  const open = useDashboardOverlay("futures-onboarding", wantsOpen);
  return <FuturesOnboardingModal open={open} onClose={onClose} onGoNovaRadar={onGoNovaRadar} />;
}
