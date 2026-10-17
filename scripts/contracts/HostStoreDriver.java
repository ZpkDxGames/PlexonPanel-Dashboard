import com.google.gson.*;
import io.github.zpkdxgames.plexonpanel.host.storage.HostSessionStore;
import io.github.zpkdxgames.plexonpanel.console.ConsoleLine;
import java.nio.file.*;
import java.time.*;
import java.util.*;
public class HostStoreDriver {
 public static void main(String[] args) throws Exception {
  Gson gson=new Gson();
  try(var store=new HostSessionStore(Path.of(args[0]),"12345678-1234-1234-1234-123456789abc",List.of());var input=new Scanner(System.in)) {
   while(input.hasNextLine()) {JsonObject request=JsonParser.parseString(input.nextLine()).getAsJsonObject(),p=request.getAsJsonObject("parameters");Object result;
    try {result=switch(request.get("action").getAsString()) {
     case "boot" -> {store.observeService(Map.of("state","active","invocationId",p.get("epoch").getAsString(),"bootStartedAt",p.has("startedAt")?p.get("startedAt").getAsString():Instant.now().minusSeconds(3600).toString()),Instant.now());yield Map.of("bootEpochId",store.bootEpochId(),"bootStartedAt",store.bootStartedAt());}
     case "stop" -> {store.observeService(Map.of("state","inactive"),Instant.now());yield store.sessionView();}
     case "console" -> {store.appendConsole(new ConsoleLine(Instant.now().toString(),"INFO",p.get("content").getAsString(),null,false,"HOST_JOURNAL",UUID.randomUUID().toString(),store.bootEpochId(),"synthetic.service","0","contract",1));yield Map.of("ok",true);}
     case "presence" -> {store.appendPresence(p);yield store.sessionView();}
     case "history" -> store.consoleHistory(p,false);
     case "session" -> store.sessionView();
     case "chat" -> store.chatHistory();
     default -> throw new IllegalArgumentException("Unknown test driver command");
    };System.out.println(gson.toJson(Map.of("id",request.get("id").getAsInt(),"data",result)));}
    catch(Exception failure){System.out.println(gson.toJson(Map.of("id",request.get("id").getAsInt(),"error",failure.getClass().getSimpleName())));}
   }
  }
 }
}
