import { useRef } from 'react';
import { Animated, Dimensions, PanResponder, type ViewStyle } from 'react-native';

const SCREEN = Dimensions.get('window').width;
const THRESHOLD = SCREEN * 0.28;

/**
 * Carta que desliza como no Tinder: direita = "bora", esquerda = "passo".
 * Também dá para acionar pelos botões chamando `ref.current.swipe(true|false)`.
 */
export function useSwipe(onDecide: (liked: boolean) => void) {
  const pos = useRef(new Animated.ValueXY()).current;
  // O PanResponder é criado uma vez; a ref garante que ele chame sempre a versão atual de onDecide
  const decide = useRef(onDecide);
  decide.current = onDecide;

  const fly = (liked: boolean) => {
    Animated.timing(pos, { toValue: { x: (liked ? 1 : -1) * SCREEN * 1.4, y: 40 }, duration: 220, useNativeDriver: true }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      decide.current(liked);
    });
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: g.dy * 0.2 }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) fly(true);
        else if (g.dx < -THRESHOLD) fly(false);
        else Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const rotate = pos.x.interpolate({ inputRange: [-SCREEN, 0, SCREEN], outputRange: ['-14deg', '0deg', '14deg'] });
  const likeOpacity = pos.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pos.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const cardStyle: Animated.WithAnimatedObject<ViewStyle> = {
    transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }],
  };

  return { handlers: responder.panHandlers, cardStyle, likeOpacity, nopeOpacity, swipe: fly };
}
