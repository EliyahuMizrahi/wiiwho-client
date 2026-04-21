package club.wiiwho;

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod(modid = Wiiwho.MODID, version = Wiiwho.VERSION, name = "Wiiwho", clientSideOnly = true, acceptedMinecraftVersions = "[1.8.9]")
public class Wiiwho {
    public static final String MODID = "wiiwho";
    public static final String VERSION = "0.1.0";
    public static final String NAME = "Wiiwho";

    private static final Logger LOGGER = LogManager.getLogger(MODID);

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        LOGGER.info("Wiiwho preInit — v{}", VERSION);
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        LOGGER.info("Wiiwho init — ready");
    }
}
