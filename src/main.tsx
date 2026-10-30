import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#d5d76f',
          colorInfo: '#22d3ee',
          colorSuccess: '#00d492',
          colorWarning: '#fbbf24',
          colorError: '#f87171',
          colorBgBase: '#0b1120',
          colorBgLayout: '#0b1120',
          colorBgContainer: '#142036',
          colorBgElevated: '#1a2740',
          colorBgSpotlight: '#1a2740',
          colorText: '#f1f5f9',
          colorTextSecondary: '#90a1b9',
          colorTextTertiary: '#62748e',
          colorTextQuaternary: '#62748e',
          colorBorder: 'rgba(255,255,255,0.10)',
          colorBorderSecondary: 'rgba(255,255,255,0.06)',
          colorFillSecondary: 'rgba(255,255,255,0.06)',
          colorFillTertiary: 'rgba(255,255,255,0.04)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: 13,
          borderRadius: 8,
          borderRadiusLG: 12,
        },
        components: {
          Layout: {
            siderBg: '#0d1526',
            headerBg: 'rgba(11,17,32,0.92)',
            headerColor: '#f1f5f9',
            bodyBg: '#0b1120',
            headerHeight: 64,
            headerPadding: '0 34px',
          },
          Menu: {
            itemBg: 'transparent',
            itemColor: '#90a1b9',
            itemHoverBg: 'rgba(255,255,255,0.05)',
            itemHoverColor: '#f1f5f9',
            itemSelectedBg: 'rgba(250,253,134,0.12)',
            itemSelectedColor: '#fafd86',
            collapsedWidth: 72,
            collapsedIconSize: 18,
          },
          Button: {
            primaryColor: '#0b1120',
            primaryShadow: 'none',
            fontWeight: 600,
          },
          Card: {
            headerFontSize: 13,
          },
          Table: {
            headerBg: '#101a2e',
            headerColor: '#62748e',
            headerSplitColor: 'rgba(255,255,255,0.06)',
            rowHoverBg: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.06)',
          },
          Modal: {
            contentBg: '#142036',
            headerBg: '#142036',
            titleColor: '#f1f5f9',
          },
          Input: {
            colorBgContainer: '#111827',
          },
          InputNumber: {
            colorBgContainer: '#111827',
          },
          Select: {
            colorBgContainer: '#111827',
            colorBgElevated: '#1a2740',
          },
          Progress: {
            remainingColor: 'rgba(255,255,255,0.06)',
          },
          Avatar: {
            colorTextPlaceholder: '#fafd86',
          },
          Alert: {
            colorInfoBg: 'rgba(34,211,238,0.08)',
            colorInfoBorder: 'rgba(34,211,238,0.25)',
            colorWarningBg: 'rgba(251,191,36,0.08)',
            colorWarningBorder: 'rgba(251,191,36,0.25)',
            colorSuccessBg: 'rgba(0,212,146,0.08)',
            colorSuccessBorder: 'rgba(0,212,146,0.25)',
            colorErrorBg: 'rgba(248,113,113,0.08)',
            colorErrorBorder: 'rgba(248,113,113,0.25)',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
 