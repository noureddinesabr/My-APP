import { forwardRef, type ComponentRef } from 'react';
import { Platform, TextInput as RNTextInput, type TextInputProps } from 'react-native';

/**
 * Every one-line writing box in the app (round 9, #69 / #91). On Android a one-line box whose text
 * is aligned right (Arabic) or centred swallows the swipe that starts on it, so the page only
 * scrolls after several tries. A multi-line box doesn't, so on Android each box is multi-line but
 * still behaves as one line: Enter sends / closes instead of starting a new line, pasted line
 * breaks become spaces, and the words stay centred in the box's height. Boxes that hide what is
 * typed (secureTextEntry) stay as they are (Android can't hide text in a multi-line box).
 */
export const TextInput = forwardRef<ComponentRef<typeof RNTextInput>, TextInputProps>(function TextInput(props, ref) {
  if (Platform.OS !== 'android' || props.multiline || props.secureTextEntry) return <RNTextInput ref={ref} {...props} />;
  const { onChangeText, blurOnSubmit, style, ...rest } = props;
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      multiline
      numberOfLines={1}
      scrollEnabled={false}
      submitBehavior={blurOnSubmit === false ? 'submit' : 'blurAndSubmit'}
      onChangeText={onChangeText ? (v) => onChangeText(v.replace(/[\r\n]+/g, ' ')) : undefined}
      style={[{ textAlignVertical: 'center' }, style]}
    />
  );
});
export type { TextInputProps };
