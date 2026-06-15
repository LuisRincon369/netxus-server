const permisos = {
  practicante:   ['kb:read', 'convencion:read', 'repo:read'],
  desarrollador: ['kb:read', 'kb:write', 'hu:read', 'hu:write',
                  'sdd:push', 'convencion:read', 'repo:read'],
  sublider:      ['kb:read', 'kb:write', 'hu:read', 'hu:write',
                  'sdd:push', 'convencion:read', 'repo:read',
                  'code:review', 'modulo:approve', 'equipo:view'],
  lider:         ['kb:read', 'kb:write', 'hu:read', 'hu:write',
                  'sdd:push', 'convencion:read', 'repo:read',
                  'code:review', 'modulo:approve', 'equipo:view',
                  'spec:approve', 'arch:decide', 'proyectos:all'],
  pmo:           ['kb:read', 'kb:write', 'hu:read', 'hu:write',
                  'sdd:push', 'convencion:read', 'repo:read',
                  'code:review', 'modulo:approve', 'equipo:view',
                  'spec:approve', 'arch:decide', 'proyectos:all',
                  'kpi:view', 'sprint:manage', 'reporte:generate'],
  gerente:       ['*'],
  admin:         ['*']
}

module.exports = (permiso) => (req, res, next) => {
  const rol = req.usuario.rol
  const lista = permisos[rol] || []
  if (lista.includes('*') || lista.includes(permiso)) {
    return next()
  }
  res.status(403).json({
    error: `Tu rol (${rol}) no tiene permiso: ${permiso}`
  })
}
