import React, { createContext, useContext } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import SaaSSidebar from './SaaSSidebar';
import { colors } from '../theme/theme';

export const DesktopSidebarContext = createContext<boolean>(false);

interface DesktopLayoutProps {
  currentTabName?: string;
  onSelectTab?: (tabName: string) => void;
  children: React.ReactNode;
}

export default function DesktopLayout({ currentTabName, onSelectTab, children }: DesktopLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const hasParentSidebar = useContext(DesktopSidebarContext);

  // If not desktop or if a parent layout already renders the sidebar, don't render a second sidebar!
  if (!isDesktop || hasParentSidebar) {
    return <>{children}</>;
  }

  return (
    <DesktopSidebarContext.Provider value={true}>
      <View style={styles.desktopLayout}>
        <SaaSSidebar currentTabName={currentTabName} onSelectTab={onSelectTab} />
        <View style={styles.desktopMainContent}>{children}</View>
      </View>
    </DesktopSidebarContext.Provider>
  );
}

const styles = StyleSheet.create({
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: colors.paper,
  },
  desktopMainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.paper,
  },
});
