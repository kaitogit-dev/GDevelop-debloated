// @flow
import * as React from 'react';
import { Trans } from '@lingui/macro';
import { Column, Line } from '../../../UI/Grid';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '../../../UI/IconButton';
import VerticalTabButton from '../../../UI/VerticalTabButton';
import DoubleChevronArrowLeft from '../../../UI/CustomSvgIcons/DoubleChevronArrowLeft';
import HammerIcon from '../../../UI/CustomSvgIcons/Hammer';
import ControllerIcon from '../../../UI/CustomSvgIcons/Controller';
import Preferences from '../../../UI/CustomSvgIcons/Preferences';
import GDevelopGLogo from '../../../UI/CustomSvgIcons/GDevelopGLogo';
import GDevelopThemeContext from '../../../UI/Theme/GDevelopThemeContext';
import HomePageMenuBar from './HomePageMenuBar';

export const styles = {
  // Ensure it's always interactive, even when another iframe disable pointer events.
  container: { pointerEvents: 'all', display: 'flex' },
  drawerContent: {
    height: '100%',
    width: 250,
    paddingBottom: 10,
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerTopButtonsContainer: {
    flex: 1,
    marginTop: 'var(--safe-area-inset-top)',
  },
  drawerBottomButtonsContainer: {
    marginBottom: 'var(--safe-area-inset-bottom)',
  },
};

export type HomeTab = 'create' | 'learn' | 'play' | 'shop' | 'team-view';

export type GetIconFunction = ({
  color: string,
  fontSize: 'inherit' | 'small',
}) => React.Node;

export type HomePageMenuTab = {|
  label: React.Node,
  tab: HomeTab,
  getIcon: GetIconFunction,
  id: string,
|};

const homePageMenuTabs: { [tab: HomeTab]: HomePageMenuTab } = {
  create: {
    label: <Trans>Create</Trans>,
    tab: 'create',
    id: 'home-create-tab',
    getIcon: ({ color, fontSize }) => (
      <HammerIcon fontSize={fontSize} color={color} />
    ),
  },
  play: {
    label: <Trans>Play</Trans>,
    tab: 'play',
    id: 'home-play-tab',
    getIcon: ({ color, fontSize }) => (
      <ControllerIcon fontSize={fontSize} color={color} />
    ),
  },

};

export const getTabsToDisplay = (): HomePageMenuTab[] => [
  homePageMenuTabs.create,
  homePageMenuTabs.play,
];

type Props = {|
  setActiveTab: HomeTab => void,
  activeTab: HomeTab,
  onOpenPreferences: () => void,
  onOpenAbout: () => void,
|};

export const HomePageMenu = ({
  setActiveTab,
  activeTab,
  onOpenPreferences,
  onOpenAbout,
}: Props): React.MixedElement => {
  const gdevelopTheme = React.useContext(GDevelopThemeContext);
  const [
    isHomePageMenuDrawerOpen,
    setIsHomePageMenuDrawerOpen,
  ] = React.useState(false);

  const tabsToDisplay = getTabsToDisplay();

  const buttons: {
    label: React.Node,
    getIcon: ({ color: string, fontSize: 'inherit' | 'small' }) => React.Node,
    id: string,
    onClick: () => void,
  }[] = [
    {
      label: <Trans>Preferences</Trans>,
      id: 'settings',
      onClick: onOpenPreferences,
      getIcon: ({ color, fontSize }) => (
        <Preferences fontSize={fontSize} color={color} />
      ),
    },
    {
      label: <Trans>About GDevelop</Trans>,
      id: 'about-gdevelop',
      onClick: onOpenAbout,
      getIcon: ({ color, fontSize }) => (
        <GDevelopGLogo fontSize={fontSize} color={color} />
      ),
    },
  ];

  return (
    <div style={styles.container}>
      <HomePageMenuBar
        activeTab={activeTab}
        onOpenAbout={onOpenAbout}
        onOpenHomePageMenuDrawer={() => setIsHomePageMenuDrawerOpen(true)}
        onOpenPreferences={onOpenPreferences}
        setActiveTab={setActiveTab}
      />
      <Drawer
        open={isHomePageMenuDrawerOpen}
        PaperProps={{
          style: {
            ...styles.drawerContent,
            backgroundColor: gdevelopTheme.home.header.backgroundColor,
          },
          className: 'safe-area-aware-left-container',
        }}
        onClose={() => {
          setIsHomePageMenuDrawerOpen(false);
        }}
        ModalProps={{
          keepMounted: true,
        }}
      >
        <Line expand>
          <Column expand>
            <div style={styles.drawerTopButtonsContainer}>
              <Column noMargin expand>
                <Line noMargin justifyContent="flex-end">
                  <IconButton
                    onClick={() => {
                      setIsHomePageMenuDrawerOpen(false);
                    }}
                    size="small"
                  >
                    <DoubleChevronArrowLeft />
                  </IconButton>
                </Line>
                {tabsToDisplay.map(({ label, tab, getIcon, id }) => (
                  <VerticalTabButton
                    key={id}
                    label={label}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsHomePageMenuDrawerOpen(false);
                    }}
                    getIcon={getIcon}
                    isActive={activeTab === tab}
                  />
                ))}
              </Column>
            </div>
            <div style={styles.drawerBottomButtonsContainer}>
              <Column noMargin>
                {buttons.map(({ label, getIcon, onClick, id }) => (
                  <VerticalTabButton
                    key={id}
                    label={label}
                    onClick={onClick}
                    getIcon={getIcon}
                    isActive={false}
                  />
                ))}
              </Column>
            </div>
          </Column>
        </Line>
      </Drawer>
    </div>
  );
};
