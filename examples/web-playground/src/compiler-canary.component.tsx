import { View, Text, createSignal, Button } from "@jue/jsx";

let pressCount = 0;

function handleClick() {
  pressCount += 1;
  console.log("Button clicked!");
}

function handleClickPressCount() {
  return pressCount;
}

export function render() {
  const aaa = createSignal("xxx1");
  return (
    <View>
      <Text>1Compiled from a </Text>
      <Text>Signal value: {aaa}</Text>
      <Button onPress={handleClick}>Click 11me</Button>
    </View>
  );
}
