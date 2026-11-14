import { FC, useId, useState } from "react";

import { TabItem, TabPanel, Tabs } from "@/components/global/Tabs";
import { AudioSettings } from "@/components/settings/AudioSettings";
import { KeyBindingsSettings } from "@/components/settings/KeyBindingsSettings";

type Tab = "audio" | "keys";
const TABS: TabItem<Tab>[] = [
  { id: "audio", label: "Son" },
  { id: "keys", label: "Touches" },
];

/** Onglets des paramètres, partagés par le menu pause et le menu principal. */
export const SettingsTabs: FC = () => {
  const [tab, setTab] = useState<Tab>("audio");
  const baseId = useId();
  return (
    <>
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Paramètres"
        baseId={baseId}
        className="mb-4"
      />
      <TabPanel baseId={baseId} id="audio" value={tab}>
        <AudioSettings />
      </TabPanel>
      <TabPanel baseId={baseId} id="keys" value={tab}>
        <KeyBindingsSettings />
      </TabPanel>
    </>
  );
};
