import { createIconSet } from "@expo/vector-icons";

const glyphMap = require("react-native-vector-icons/glyphmaps/Ionicons.json");
const font = require("react-native-vector-icons/Fonts/Ionicons.ttf");

const Ionicons = createIconSet(glyphMap, "ionicons-orya", font);

export { Ionicons };
export default Ionicons;
