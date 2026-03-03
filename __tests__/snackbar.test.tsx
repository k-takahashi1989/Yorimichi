/**
 * Snackbar コンポーネント ユニットテスト
 * Fix #1: アクションボタン押下で即 onDismiss が呼ばれること
 */

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Snackbar from '../src/components/Snackbar';

describe('Snackbar', () => {
  it('アクションボタン押下で onAction と onDismiss が即時呼ばれる', async () => {
    const onDismiss = jest.fn();
    const onAction = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <Snackbar
          visible={true}
          message="テスト"
          actionLabel="元に戻す"
          onAction={onAction}
          onDismiss={onDismiss}
        />,
      );
    });

    // TouchableOpacity リストの最後がアクションボタン
    const { TouchableOpacity } = require('react-native');
    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const actionBtn = buttons[buttons.length - 1];

    await ReactTestRenderer.act(async () => {
      actionBtn.props.onPress();
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('visible=false のとき pointerEvents が none になる', async () => {
    const onDismiss = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <Snackbar
          visible={false}
          message="テスト"
          onDismiss={onDismiss}
        />,
      );
    });

    const { Animated } = require('react-native');
    const animView = renderer.root.findByType(Animated.View);
    expect(animView.props.pointerEvents).toBe('none');
  });
});
