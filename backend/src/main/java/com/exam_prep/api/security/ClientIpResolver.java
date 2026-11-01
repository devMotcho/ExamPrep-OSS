package com.exam_prep.api.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.Inet6Address;
import java.net.UnknownHostException;

/**
 * The address rate limits and login lockouts are keyed on. Request headers are never read here, as anyone can
 * send them: with {@code server.forward-headers-strategy=native}, Tomcat only applies X-Forwarded-For when the
 * connection comes from a trusted proxy ({@code server.tomcat.remoteip.internal-proxies}).
 */
@Component
public class ClientIpResolver {

    public String resolveClientIp(HttpServletRequest request) {
        return request == null ? "0.0.0.0" : request.getRemoteAddr();
    }

    /** What limits count against: the address, or for IPv6 its /64, as one customer usually holds a whole /64. */
    public String resolveClientKey(HttpServletRequest request) {
        return limitKey(resolveClientIp(request));
    }

    public static String limitKey(String ip) {
        // Only a literal with a colon is parsed, so this can never trigger a DNS lookup.
        if (ip == null || !ip.contains(":")) {
            return ip;
        }
        int zone = ip.indexOf('%');
        try {
            InetAddress address = InetAddress.getByName(zone >= 0 ? ip.substring(0, zone) : ip);
            if (!(address instanceof Inet6Address)) {
                return address.getHostAddress(); // an IPv4-mapped address
            }
            byte[] b = address.getAddress();
            return String.format("%x:%x:%x:%x::/64",
                    ((b[0] & 0xff) << 8) | (b[1] & 0xff), ((b[2] & 0xff) << 8) | (b[3] & 0xff),
                    ((b[4] & 0xff) << 8) | (b[5] & 0xff), ((b[6] & 0xff) << 8) | (b[7] & 0xff));
        } catch (UnknownHostException e) {
            return ip;
        }
    }
}
