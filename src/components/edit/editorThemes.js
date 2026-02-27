/**
 * Editor themes — each theme is a flat set of hex colors applied via CSS custom properties.
 * Grouped into light and dark families for the picker UI.
 */

const themes = [
  // ── Light family ──
  {
    key: 'light',
    name: 'Light',
    family: 'light',
    colors: {
      bg: '#FFFFFF', text: '#000000', placeholder: '#CBD5E1', caret: '#000000',
      chrome: '#F9FAFB', chromeBorder: '#E5E7EB', chromeText: '#6B7280',
      statusBg: '#F3F4F6', statusText: '#9CA3AF',
      tabActiveBg: '#FFFFFF', tabActiveText: '#000000',
      tabInactiveBg: '#F3F4F6', tabInactiveText: '#6B7280', tabHoverBg: '#F9FAFB',
      toolbarBtn: '#6B7280', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#E5E7EB',
    },
  },
  {
    key: 'paper',
    name: 'Paper',
    family: 'light',
    colors: {
      bg: '#F5F0EB', text: '#000000', placeholder: '#B8AFA6', caret: '#000000',
      chrome: '#EDE7E0', chromeBorder: '#D6CEC5', chromeText: '#7A7068',
      statusBg: '#EDE7E0', statusText: '#9A9088',
      tabActiveBg: '#F5F0EB', tabActiveText: '#000000',
      tabInactiveBg: '#EDE7E0', tabInactiveText: '#7A7068', tabHoverBg: '#F0EAE3',
      toolbarBtn: '#7A7068', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#D6CEC5',
    },
  },
  {
    key: 'sepia',
    name: 'Sepia',
    family: 'light',
    colors: {
      bg: '#F4ECD8', text: '#000000', placeholder: '#C4B89A', caret: '#000000',
      chrome: '#EBE1C8', chromeBorder: '#D6C9A8', chromeText: '#7A6B50',
      statusBg: '#EBE1C8', statusText: '#9A8B70',
      tabActiveBg: '#F4ECD8', tabActiveText: '#000000',
      tabInactiveBg: '#EBE1C8', tabInactiveText: '#7A6B50', tabHoverBg: '#F0E6CF',
      toolbarBtn: '#7A6B50', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#D6C9A8',
    },
  },
  {
    key: 'solarizedLight',
    name: 'Solarized Light',
    family: 'light',
    colors: {
      bg: '#FDF6E3', text: '#000000', placeholder: '#B8C4C6', caret: '#000000',
      chrome: '#EEE8D5', chromeBorder: '#DDD6C1', chromeText: '#93A1A1',
      statusBg: '#EEE8D5', statusText: '#93A1A1',
      tabActiveBg: '#FDF6E3', tabActiveText: '#000000',
      tabInactiveBg: '#EEE8D5', tabInactiveText: '#93A1A1', tabHoverBg: '#F5EFDC',
      toolbarBtn: '#93A1A1', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#DDD6C1',
    },
  },
  {
    key: 'gruvboxLight',
    name: 'Gruvbox Light',
    family: 'light',
    colors: {
      bg: '#FBF1C7', text: '#000000', placeholder: '#BDAE93', caret: '#000000',
      chrome: '#EBDBB2', chromeBorder: '#D5C4A1', chromeText: '#665C54',
      statusBg: '#EBDBB2', statusText: '#928374',
      tabActiveBg: '#FBF1C7', tabActiveText: '#000000',
      tabInactiveBg: '#EBDBB2', tabInactiveText: '#665C54', tabHoverBg: '#F2E8B5',
      toolbarBtn: '#665C54', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#D5C4A1',
    },
  },
  {
    key: 'github',
    name: 'GitHub',
    family: 'light',
    colors: {
      bg: '#FFFFFF', text: '#000000', placeholder: '#C6CDD5', caret: '#000000',
      chrome: '#F6F8FA', chromeBorder: '#E1E4E8', chromeText: '#586069',
      statusBg: '#F6F8FA', statusText: '#959DA5',
      tabActiveBg: '#FFFFFF', tabActiveText: '#000000',
      tabInactiveBg: '#F6F8FA', tabInactiveText: '#586069', tabHoverBg: '#F0F2F5',
      toolbarBtn: '#586069', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#E1E4E8',
    },
  },

  // ── High-Contrast family ──
  {
    key: 'highContrastLight',
    name: 'High Contrast Light',
    family: 'light',
    colors: {
      bg: '#FFFFFF', text: '#000000', placeholder: '#767676', caret: '#000000',
      chrome: '#F0F0F0', chromeBorder: '#000000', chromeText: '#000000',
      statusBg: '#E0E0E0', statusText: '#000000',
      tabActiveBg: '#FFFFFF', tabActiveText: '#000000',
      tabInactiveBg: '#E0E0E0', tabInactiveText: '#000000', tabHoverBg: '#D0D0D0',
      toolbarBtn: '#000000', toolbarBtnHover: '#000000', toolbarBtnHoverBg: '#CCCCCC',
    },
  },
  {
    key: 'highContrastDark',
    name: 'High Contrast Dark',
    family: 'dark',
    colors: {
      bg: '#000000', text: '#FFFFFF', placeholder: '#AAAAAA', caret: '#FFFFFF',
      chrome: '#1A1A1A', chromeBorder: '#FFFFFF', chromeText: '#FFFFFF',
      statusBg: '#1A1A1A', statusText: '#FFFFFF',
      tabActiveBg: '#000000', tabActiveText: '#FFFFFF',
      tabInactiveBg: '#1A1A1A', tabInactiveText: '#CCCCCC', tabHoverBg: '#333333',
      toolbarBtn: '#FFFFFF', toolbarBtnHover: '#FFFFFF', toolbarBtnHoverBg: '#444444',
    },
  },

  // ── Dark family ──
  {
    key: 'dark',
    name: 'Dark',
    family: 'dark',
    colors: {
      bg: '#1E293B', text: '#E2E8F0', placeholder: '#475569', caret: '#E2E8F0',
      chrome: '#1E293B', chromeBorder: '#334155', chromeText: '#94A3B8',
      statusBg: '#1E293B', statusText: '#64748B',
      tabActiveBg: '#1E293B', tabActiveText: '#F1F5F9',
      tabInactiveBg: '#0F172A', tabInactiveText: '#64748B', tabHoverBg: '#1E293B',
      toolbarBtn: '#94A3B8', toolbarBtnHover: '#F1F5F9', toolbarBtnHoverBg: '#334155',
    },
  },
  {
    key: 'nord',
    name: 'Nord',
    family: 'dark',
    colors: {
      bg: '#2E3440', text: '#D8DEE9', placeholder: '#4C566A', caret: '#88C0D0',
      chrome: '#3B4252', chromeBorder: '#434C5E', chromeText: '#81A1C1',
      statusBg: '#3B4252', statusText: '#81A1C1',
      tabActiveBg: '#2E3440', tabActiveText: '#ECEFF4',
      tabInactiveBg: '#3B4252', tabInactiveText: '#81A1C1', tabHoverBg: '#434C5E',
      toolbarBtn: '#81A1C1', toolbarBtnHover: '#ECEFF4', toolbarBtnHoverBg: '#434C5E',
    },
  },
  {
    key: 'dracula',
    name: 'Dracula',
    family: 'dark',
    colors: {
      bg: '#282A36', text: '#F8F8F2', placeholder: '#6272A4', caret: '#FF79C6',
      chrome: '#21222C', chromeBorder: '#44475A', chromeText: '#BD93F9',
      statusBg: '#21222C', statusText: '#6272A4',
      tabActiveBg: '#282A36', tabActiveText: '#F8F8F2',
      tabInactiveBg: '#21222C', tabInactiveText: '#6272A4', tabHoverBg: '#44475A',
      toolbarBtn: '#BD93F9', toolbarBtnHover: '#F8F8F2', toolbarBtnHoverBg: '#44475A',
    },
  },
  {
    key: 'solarizedDark',
    name: 'Solarized Dark',
    family: 'dark',
    colors: {
      bg: '#002B36', text: '#839496', placeholder: '#586E75', caret: '#2AA198',
      chrome: '#073642', chromeBorder: '#094959', chromeText: '#93A1A1',
      statusBg: '#073642', statusText: '#657B83',
      tabActiveBg: '#002B36', tabActiveText: '#93A1A1',
      tabInactiveBg: '#073642', tabInactiveText: '#657B83', tabHoverBg: '#094959',
      toolbarBtn: '#93A1A1', toolbarBtnHover: '#EEE8D5', toolbarBtnHoverBg: '#094959',
    },
  },
  {
    key: 'gruvboxDark',
    name: 'Gruvbox Dark',
    family: 'dark',
    colors: {
      bg: '#282828', text: '#EBDBB2', placeholder: '#665C54', caret: '#FE8019',
      chrome: '#1D2021', chromeBorder: '#3C3836', chromeText: '#A89984',
      statusBg: '#1D2021', statusText: '#928374',
      tabActiveBg: '#282828', tabActiveText: '#FBF1C7',
      tabInactiveBg: '#1D2021', tabInactiveText: '#928374', tabHoverBg: '#3C3836',
      toolbarBtn: '#A89984', toolbarBtnHover: '#FBF1C7', toolbarBtnHoverBg: '#3C3836',
    },
  },
  {
    key: 'oneDark',
    name: 'One Dark',
    family: 'dark',
    colors: {
      bg: '#282C34', text: '#ABB2BF', placeholder: '#5C6370', caret: '#528BFF',
      chrome: '#21252B', chromeBorder: '#3E4451', chromeText: '#636D83',
      statusBg: '#21252B', statusText: '#636D83',
      tabActiveBg: '#282C34', tabActiveText: '#D7DAE0',
      tabInactiveBg: '#21252B', tabInactiveText: '#636D83', tabHoverBg: '#2C313A',
      toolbarBtn: '#636D83', toolbarBtnHover: '#D7DAE0', toolbarBtnHoverBg: '#3E4451',
    },
  },
  {
    key: 'tokyoNight',
    name: 'Tokyo Night',
    family: 'dark',
    colors: {
      bg: '#1A1B26', text: '#A9B1D6', placeholder: '#414868', caret: '#7AA2F7',
      chrome: '#16161E', chromeBorder: '#292E42', chromeText: '#565F89',
      statusBg: '#16161E', statusText: '#565F89',
      tabActiveBg: '#1A1B26', tabActiveText: '#C0CAF5',
      tabInactiveBg: '#16161E', tabInactiveText: '#565F89', tabHoverBg: '#292E42',
      toolbarBtn: '#565F89', toolbarBtnHover: '#C0CAF5', toolbarBtnHoverBg: '#292E42',
    },
  },
  {
    key: 'monokai',
    name: 'Monokai',
    family: 'dark',
    colors: {
      bg: '#272822', text: '#F8F8F2', placeholder: '#75715E', caret: '#F92672',
      chrome: '#1E1F1C', chromeBorder: '#3E3D32', chromeText: '#A6E22E',
      statusBg: '#1E1F1C', statusText: '#75715E',
      tabActiveBg: '#272822', tabActiveText: '#F8F8F2',
      tabInactiveBg: '#1E1F1C', tabInactiveText: '#75715E', tabHoverBg: '#3E3D32',
      toolbarBtn: '#A6E22E', toolbarBtnHover: '#F8F8F2', toolbarBtnHoverBg: '#3E3D32',
    },
  },
];

export default themes;

export function getTheme(key) {
  return themes.find((t) => t.key === key) || themes[0];
}

export const lightThemes = themes.filter((t) => t.family === 'light');
export const darkThemes = themes.filter((t) => t.family === 'dark');
