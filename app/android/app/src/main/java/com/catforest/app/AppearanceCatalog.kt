package com.catforest.app

/** Exact kn / Mi catalog in the supplied 小橘电子宠物.html (SHA-256 in assets/provenance.json). */
object AppearanceCatalog {
    data class Breed(val id: String, val name: String, val description: String, val color: String, val rare: Boolean = false)
    data class Outfit(val id: String, val name: String, val description: String, val price: Int, val gift: Boolean = false)

    val breeds = listOf(
        Breed("orange", "橘白田园猫", "爱晒太阳的小吃货，橘色条纹配白围兜。", "#dd8b48"),
        Breed("silver", "银虎斑", "银灰底色、深色虎斑，眼神里装着好奇。", "#a4abb2"),
        Breed("tuxedo", "奶牛猫", "黑白小礼服，总有一点古灵精怪。", "#40494e"),
        Breed("siamese", "暹罗猫", "奶油色身体、深色脸和爪，喜欢与你作伴。", "#b2967c"),
        Breed("ragdoll", "布偶猫", "柔软的浅色毛与蓝眼睛，安静地陪你生活。", "#c9bcb2"),
        Breed("blue", "英短蓝猫", "圆圆脸、蓝灰毛，是一位温柔的小室友。", "#798fa0"),
        Breed("calico", "三花猫", "白底橘黑三色花斑，只出现在联机生蛋的后代里。", "#e8c9a0", rare = true),
        Breed("golden", "金渐层", "毛尖泛金的渐层毛色，只出现在联机生蛋的后代里。", "#e0b25a", rare = true),
        Breed("starry", "星空猫", "深蓝夜空色带星点，鸳鸯眼，最稀有的联姻后代。", "#2f3a66", rare = true)
    )
    val outfits = listOf(
        Outfit("bandana", "莓莓三角巾", "给胸前添一块暖红色小围巾。", 12),
        Outfit("bow", "蝴蝶结", "今天也要打扮得可可爱爱。", 18),
        Outfit("cap", "小鸭遮阳帽", "一顶青蓝色的像素小帽子。", 25),
        Outfit("raincoat", "晴黄雨衣", "雨天出门也可以亮亮的。", 36),
        Outfit("backpack", "探险小背包", "带上好奇心，到庭院和河岸走一走。", 32),
        Outfit("scarf", "暖暖针织围巾", "一圈柔和的青蓝色温暖。", 28),
        Outfit("sakura", "樱花发卡", "馈赠限定：只在 Fate 缘分擦肩的大礼物里出现。", 0, gift = true),
        Outfit("bell", "铃铛项圈", "馈赠限定：走起来叮铃叮铃。", 0, gift = true),
        Outfit("crown", "星星小王冠", "馈赠限定：缘分擦肩时最常收到的大礼物。", 0, gift = true),
        Outfit("cape", "夜空小斗篷", "馈赠限定：缀着星星的小斗篷。", 0, gift = true)
    )
}
